const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");

const { getActiveUserRole, assertInventoryMasterRole } = require("../sales/shared/auth");
const { validatePhoneNumber } = require("../sales/shared/validators");
const { generateNextSupplierCode, generateNextProductCode } = require("../sales/shared/codes");

const SUPPLIER_OPERATION_LOCK_KEY = 820001;
const PRODUCT_OPERATION_LOCK_KEY = 820002;

const normalizeComparableText = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const acquireAdvisoryLock = async (client, lockKey) => {
  await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);
};

const assertUniqueSupplierFields = async (client, supplierName, phoneNumber, ignoreSupplierId = null) => {
  const nameCheck = await client.query(
    `
    SELECT 1
    FROM tbl_suppliers
    WHERE LOWER(TRIM(supplier_name)) = $1
      ${ignoreSupplierId ? "AND id_supplier <> $2" : ""}
    LIMIT 1;
    `,
    ignoreSupplierId ? [normalizeComparableText(supplierName), ignoreSupplierId] : [normalizeComparableText(supplierName)]
  );
  if (nameCheck.rowCount > 0) {
    throw new Error("supplier_name already exists.");
  }

  const digitsOnly = normalizeDigitsOnly(phoneNumber);
  if (digitsOnly) {
    const phoneCheck = await client.query(
      `
      SELECT 1
      FROM tbl_suppliers
      WHERE regexp_replace(COALESCE(phone_number, ''), '[^0-9]+', '', 'g') = $1
        ${ignoreSupplierId ? "AND id_supplier <> $2" : ""}
      LIMIT 1;
      `,
      ignoreSupplierId ? [digitsOnly, ignoreSupplierId] : [digitsOnly]
    );
    if (phoneCheck.rowCount > 0) {
      throw new Error("phone_number already exists.");
    }
  }
};

const assertUniqueProductName = async (client, productName, ignoreProductId = null) => {
  const result = await client.query(
    `
    SELECT 1
    FROM tbl_products
    WHERE LOWER(TRIM(product_name)) = $1
      ${ignoreProductId ? "AND id_product <> $2" : ""}
    LIMIT 1;
    `,
    ignoreProductId ? [normalizeComparableText(productName), ignoreProductId] : [normalizeComparableText(productName)]
  );
  if (result.rowCount > 0) {
    throw new Error("product_name already exists.");
  }
};

const uploadsRootDir = path.join(__dirname, "..", "..", "uploads");
const productUploadsDir = path.join(uploadsRootDir, "products");
if (!fs.existsSync(productUploadsDir)) {
  fs.mkdirSync(productUploadsDir, { recursive: true });
}

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
}).single("image");

const uploadProductImage = (req, res) => {
  productImageUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: "Failed to upload product image.", error: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: "image file is required." });
    }

    const relativePath = `uploads/products/${req.file.filename}`.replace(/\\/g, "/");
    const imageUrl = `${req.protocol}://${req.get("host")}/${relativePath}`;

    logActivity(pool, req, {
      idUser: req.body?.id_user || null,
      activityType: "UPLOAD_PRODUCT_IMAGE",
      description: `Uploaded product image: ${req.file.filename}.`,
    }).catch((err) => console.warn("Failed to log product image upload:", err.message));

    return res.status(201).json({
      message: "Product image uploaded successfully.",
      data: {
        file_name: req.file.filename,
        file_path: relativePath,
        image_url: imageUrl,
      },
    });
  });
};

const parseProductUploadFilePath = (productImageValue) => {
  const raw = String(productImageValue || "").trim();
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      pathname = parsed.pathname || "";
    } catch {
      pathname = raw;
    }
  }

  const normalized = pathname.replace(/\\/g, "/");
  const marker = "/uploads/products/";
  const index = normalized.toLowerCase().indexOf(marker);
  if (index < 0) return null;

  const fileName = normalized.slice(index + marker.length).split("/")[0];
  if (!fileName) return null;

  const safeFileName = path.basename(fileName);
  const resolved = path.resolve(productUploadsDir, safeFileName);
  const rootResolved = path.resolve(productUploadsDir);
  if (!resolved.startsWith(rootResolved)) return null;
  return resolved;
};

const removeUploadedProductImageIfAny = (productImageValue) => {
  const targetPath = parseProductUploadFilePath(productImageValue);
  if (!targetPath) return;
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
};

const getProducts = async (req, res) => {
  const search = String(req.query.search || "").trim();
  const includeInactive = String(req.query.include_inactive || "") === "1";

  try {
    const result = await pool.query(
      `
      WITH stock AS (
        SELECT
          sm.id_product,
          SUM(
            CASE
              WHEN sm.movement_type = 'OUT' THEN -sm.quantity
              ELSE sm.quantity
            END
          )::int AS available_stock
        FROM tbl_stock_movements sm
        WHERE sm.is_active = 'Y'
        GROUP BY sm.id_product
      )
      SELECT
        p.id_product,
        p.id_supplier,
        p.is_active,
        p.product_code,
        p.barcode,
        p.product_name,
        p.description,
        p.selling_price::float AS selling_price,
        p.minimum_stock,
        p.product_image,
        pr.supplier_code,
        pr.supplier_name,
        GREATEST(COALESCE(s.available_stock, 0), 0)::int AS available_stock,
        MIN(pb.expired_date) AS nearest_expired_date
      FROM tbl_products p
      LEFT JOIN tbl_suppliers pr
        ON pr.id_supplier = p.id_supplier
      LEFT JOIN stock s
        ON s.id_product = p.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product = p.id_product
      WHERE ($3::boolean = true OR p.is_active = 'Y')
        AND (
          $1 = ''
          OR p.product_code ILIKE $2
          OR p.barcode ILIKE $2
          OR p.product_name ILIKE $2
          OR p.description ILIKE $2
        )
      GROUP BY
        p.id_product,
        p.product_code,
        p.barcode,
        p.product_name,
        p.description,
        p.selling_price,
        p.minimum_stock,
        p.product_image,
        pr.supplier_code,
        pr.supplier_name,
        s.available_stock
      ORDER BY p.product_name ASC;
      `,
      [search, `%${search}%`, includeInactive]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch products.",
      error: error.message,
    });
  }
};

const createSupplier = async (req, res) => {
  const { id_user, supplier_code, supplier_name, city, phone_number } = req.body || {};
  const inputCode = String(supplier_code || "").trim().toUpperCase();
  const name = String(supplier_name || "").trim();
  const cityValue = String(city || "").trim();
  let phoneValue = null;

  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!name) return res.status(400).json({ message: "supplier_name is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);
    phoneValue = validatePhoneNumber(phone_number);

    await acquireAdvisoryLock(client, SUPPLIER_OPERATION_LOCK_KEY);
    await assertUniqueSupplierFields(client, name, phoneValue);

    const code = inputCode || (await generateNextSupplierCode(client));

    const exists = await client.query(
      `SELECT 1 FROM tbl_suppliers WHERE UPPER(TRIM(supplier_code)) = $1 LIMIT 1;`,
      [code]
    );
    if (exists.rowCount > 0) throw new Error("supplier_code already exists.");

    const result = await client.query(
      `
      INSERT INTO tbl_suppliers (
        supplier_code, supplier_name, city, phone_number, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id_supplier, supplier_code, supplier_name, city, phone_number, is_active;
      `,
      [code, name, cityValue || null, phoneValue, id_user]
    );
    await logActivity(client, req, {
      idUser: id_user,
      activityType: "CREATE_SUPPLIER",
      tableName: "tbl_suppliers",
      recordId: result.rows[0].id_supplier,
      description: `Created supplier ${code}.`,
    });

    await client.query("COMMIT");
    res.status(201).json({ message: "Supplier created successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to create supplier.", error: error.message });
  } finally {
    client.release();
  }
};

const updateSupplier = async (req, res) => {
  const idSupplier = String(req.params.idSupplier || "").trim();
  const { id_user, supplier_name, city, phone_number } = req.body || {};
  const name = String(supplier_name || "").trim();
  const cityValue = String(city || "").trim();
  let phoneValue = null;

  if (!idSupplier) return res.status(400).json({ message: "idSupplier is required." });
  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!name) return res.status(400).json({ message: "supplier_name is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);
    phoneValue = validatePhoneNumber(phone_number);

    await acquireAdvisoryLock(client, SUPPLIER_OPERATION_LOCK_KEY);
    await assertUniqueSupplierFields(client, name, phoneValue, idSupplier);

    const result = await client.query(
      `
      UPDATE tbl_suppliers
      SET
        supplier_name = $2,
        city = $3,
        phone_number = $4,
        last_modify_date = NOW(),
        last_modify_by = $5
      WHERE id_supplier = $1
      RETURNING id_supplier, supplier_code, supplier_name, city, phone_number, is_active;
      `,
      [idSupplier, name, cityValue || null, phoneValue, id_user]
    );
    if (result.rowCount === 0) throw new Error("Supplier not found.");
    await logActivity(client, req, {
      idUser: id_user,
      activityType: "UPDATE_SUPPLIER",
      tableName: "tbl_suppliers",
      recordId: result.rows[0].id_supplier,
      description: `Updated supplier ${result.rows[0].supplier_code}.`,
    });

    await client.query("COMMIT");
    res.json({ message: "Supplier updated successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to update supplier.", error: error.message });
  } finally {
    client.release();
  }
};

const setSupplierActiveState = async (req, res) => {
  const idSupplier = String(req.params.idSupplier || "").trim();
  const { id_user, is_active } = req.body || {};
  const nextState = String(is_active || "").trim().toUpperCase();

  if (!idSupplier) return res.status(400).json({ message: "idSupplier is required." });
  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!["Y", "N"].includes(nextState)) return res.status(400).json({ message: "is_active must be Y or N." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);

    const result = await client.query(
      `
      UPDATE tbl_suppliers
      SET
        is_active = $2,
        last_modify_date = NOW(),
        last_modify_by = $3
      WHERE id_supplier = $1
      RETURNING id_supplier, supplier_code, supplier_name, city, phone_number, is_active;
      `,
      [idSupplier, nextState, id_user]
    );
    if (result.rowCount === 0) throw new Error("Supplier not found.");
    await logActivity(client, req, {
      idUser: id_user,
      activityType: nextState === "Y" ? "ACTIVATE_SUPPLIER" : "DEACTIVATE_SUPPLIER",
      tableName: "tbl_suppliers",
      recordId: result.rows[0].id_supplier,
      description: `${nextState === "Y" ? "Activated" : "Deactivated"} supplier ${result.rows[0].supplier_code}.`,
    });

    await client.query("COMMIT");
    res.json({ message: "Supplier status updated successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to update supplier status.", error: error.message });
  } finally {
    client.release();
  }
};


const getBatches = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      WITH batch_qty AS (
        SELECT
          sm.id_product_batch,
          COALESCE(
            SUM(
              CASE
                WHEN sm.movement_type = 'IN' THEN sm.quantity
                ELSE 0
              END
            ),
            0
          )::int AS qty_in,
          GREATEST(
            COALESCE(
              SUM(
                CASE
                  WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                  ELSE sm.quantity
                END
              ),
              0
            ),
            0
          )::int AS current_qty
        FROM tbl_stock_movements sm
        WHERE sm.is_active = 'Y'
          AND sm.id_product_batch IS NOT NULL
        GROUP BY sm.id_product_batch
      ),
      batch_rows AS (
        SELECT
          pb.id_product_batch,
          pb.batch_code,
          pb.expired_date,
          pb.purchase_price::float AS purchase_price,
          pb.created_date AS stock_in_time,
          p.id_product,
          p.product_name,
          COALESCE(pr.supplier_name, '-') AS supplier_name,
          COALESCE(iq.qty_in, 0)::int AS qty_in,
          COALESCE(iq.current_qty, 0)::int AS current_qty
        FROM tbl_product_batches pb
        JOIN tbl_products p
          ON p.id_product = pb.id_product
        LEFT JOIN tbl_suppliers pr
          ON pr.id_supplier = p.id_supplier
        LEFT JOIN batch_qty iq
          ON iq.id_product_batch = pb.id_product_batch
        WHERE (
          $1 = ''
          OR pb.batch_code ILIKE $2
          OR p.product_name ILIKE $2
          OR COALESCE(pr.supplier_name, '') ILIKE $2
        )
      ),
      batch_items AS (
        SELECT
          br.batch_code,
          br.expired_date,
          br.product_name,
          SUM(br.qty_in)::int AS qty_in,
          SUM(br.current_qty)::int AS current_qty
        FROM batch_rows br
        GROUP BY br.batch_code, br.expired_date, br.product_name
      )
      SELECT
        MIN(br.id_product_batch::text) AS id_product_batch,
        br.batch_code,
        br.expired_date,
        MIN(br.purchase_price)::float AS purchase_price,
        MIN(br.stock_in_time) AS stock_in_time,
        STRING_AGG(DISTINCT br.product_name, ', ') AS product_name,
        ARRAY_AGG(DISTINCT br.product_name) AS product_names,
        COUNT(DISTINCT br.id_product)::int AS product_count,
        STRING_AGG(DISTINCT br.supplier_name, ', ') AS supplier_name,
        STRING_AGG(DISTINCT br.supplier_name, ', ') AS supplier_name,
        COALESCE(SUM(br.qty_in), 0)::int AS qty_in,
        COALESCE(SUM(br.current_qty), 0)::int AS current_qty,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'product_name', bi.product_name,
              'qty_in', bi.qty_in,
              'current_qty', bi.current_qty
            )
            ORDER BY bi.product_name
          )
          FROM batch_items bi
          WHERE bi.batch_code = br.batch_code
            AND bi.expired_date = br.expired_date
        ) AS product_items
      FROM batch_rows br
      GROUP BY br.batch_code, br.expired_date
      ORDER BY MIN(br.stock_in_time) DESC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch batches.",
      error: error.message,
    });
  }
};


const getSuppliers = async (req, res) => {
  const search = String(req.query.search || "").trim();
  const activeOnly = req.query.active_only === "true";

  try {
    const result = await pool.query(
      `
      SELECT
        pr.id_supplier,
        pr.supplier_code,
        pr.supplier_name,
        pr.city,
        pr.phone_number,
        pr.is_active
      FROM tbl_suppliers pr
      WHERE ($3::boolean = false OR pr.is_active = 'Y')
        AND (
        $1 = ''
        OR pr.supplier_code ILIKE $2
        OR pr.supplier_name ILIKE $2
        OR pr.city ILIKE $2
        OR pr.phone_number ILIKE $2
      )
      ORDER BY pr.supplier_name ASC;
      `,
      [search, `%${search}%`, activeOnly]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch suppliers.",
      error: error.message,
    });
  }
};

const getProductsBySupplier = async (req, res) => {
  const idSupplier = String(req.params.idSupplier || req.params.idSupplier || "").trim();

  if (!idSupplier) {
    return res.status(400).json({ message: "idSupplier is required." });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        p.id_product,
        p.product_code,
        p.product_name,
        p.barcode,
        p.selling_price::float AS selling_price,
        p.is_active
      FROM tbl_products p
      WHERE p.id_supplier = $1 AND p.is_active = 'Y'
      ORDER BY p.product_name ASC;
      `,
      [idSupplier]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch supplier products.",
      error: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  const {
    id_user,
    id_supplier,
    barcode,
    product_name,
    description,
    selling_price,
    minimum_stock,
    product_image,
  } = req.body || {};

  const bar = String(barcode || "").trim();
  const name = String(product_name || "").trim();
  const desc = String(description || "").trim();
  const price = Number(selling_price ?? 0);
  const minStock = Number(minimum_stock ?? 0);

  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!id_supplier) return res.status(400).json({ message: "id_supplier is required." });
  if (!name) return res.status(400).json({ message: "product_name is required." });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "selling_price must be >= 0." });
  if (!Number.isInteger(minStock) || minStock < 0) return res.status(400).json({ message: "minimum_stock must be an integer >= 0." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);

    await acquireAdvisoryLock(client, PRODUCT_OPERATION_LOCK_KEY);
    const supplierResult = await client.query(
      `SELECT id_supplier FROM tbl_suppliers WHERE id_supplier = $1 AND is_active = 'Y' LIMIT 1;`,
      [id_supplier]
    );
    if (supplierResult.rowCount === 0) throw new Error("Supplier not found or inactive.");
    if (bar && !/^\d+$/.test(bar)) throw new Error("barcode must contain digits only.");
    await assertUniqueProductName(client, name);
    const code = await generateNextProductCode(client, name);

    if (bar) {
      const barcodeExists = await client.query(
        `SELECT 1 FROM tbl_products WHERE TRIM(COALESCE(barcode, '')) = $1 LIMIT 1;`,
        [bar]
      );
      if (barcodeExists.rowCount > 0) throw new Error("barcode already exists.");
    }

    const result = await client.query(
      `
      INSERT INTO tbl_products (
        product_code, barcode, product_name, description, id_supplier,
        selling_price, minimum_stock, product_image, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING
        id_product, id_supplier, product_code, barcode, product_name, description,
        selling_price::float AS selling_price, minimum_stock, product_image, is_active;
      `,
      [code, bar || null, name, desc || null, id_supplier, price, minStock, String(product_image || "").trim() || null, id_user]
    );
    await logActivity(client, req, {
      idUser: id_user,
      activityType: "CREATE_PRODUCT",
      tableName: "tbl_products",
      recordId: result.rows[0].id_product,
      description: `Created product ${result.rows[0].product_code}.`,
    });

    await client.query("COMMIT");
    res.status(201).json({ message: "Product created successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to create product.", error: error.message });
  } finally {
    client.release();
  }
};

const updateProduct = async (req, res) => {
  const idProduct = String(req.params.idProduct || "").trim();
  const {
    id_user,
    id_supplier,
    barcode,
    product_name,
    description,
    selling_price,
    minimum_stock,
    product_image,
  } = req.body || {};

  const bar = String(barcode || "").trim();
  const name = String(product_name || "").trim();
  const desc = String(description || "").trim();
  const price = Number(selling_price ?? 0);
  const minStock = Number(minimum_stock ?? 0);

  if (!idProduct) return res.status(400).json({ message: "idProduct is required." });
  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!id_supplier) return res.status(400).json({ message: "id_supplier is required." });
  if (!name) return res.status(400).json({ message: "product_name is required." });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "selling_price must be >= 0." });
  if (!Number.isInteger(minStock) || minStock < 0) return res.status(400).json({ message: "minimum_stock must be an integer >= 0." });

  const client = await pool.connect();
  let previousProductImage = null;
  let nextProductImage = null;
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);

    await acquireAdvisoryLock(client, PRODUCT_OPERATION_LOCK_KEY);
    const supplierResult = await client.query(
      `SELECT id_supplier FROM tbl_suppliers WHERE id_supplier = $1 AND is_active = 'Y' LIMIT 1;`,
      [id_supplier]
    );
    if (supplierResult.rowCount === 0) throw new Error("Supplier not found or inactive.");
    if (bar && !/^\d+$/.test(bar)) throw new Error("barcode must contain digits only.");

    if (bar) {
      const barcodeExists = await client.query(
        `SELECT 1 FROM tbl_products WHERE TRIM(COALESCE(barcode, '')) = $1 AND id_product <> $2 LIMIT 1;`,
        [bar, idProduct]
      );
      if (barcodeExists.rowCount > 0) throw new Error("barcode already exists.");
    }
    await assertUniqueProductName(client, name, idProduct);

    const existingProductResult = await client.query(
      `SELECT product_image FROM tbl_products WHERE id_product = $1 LIMIT 1;`,
      [idProduct]
    );
    if (existingProductResult.rowCount === 0) throw new Error("Product not found.");
    previousProductImage = existingProductResult.rows[0]?.product_image || null;
    nextProductImage = String(product_image || "").trim() || null;

    const result = await client.query(
      `
      UPDATE tbl_products
      SET
        id_supplier = $2,
        barcode = $3,
        product_name = $4,
        description = $5,
        selling_price = $6,
        minimum_stock = $7,
        product_image = $8,
        last_modify_date = NOW(),
        last_modify_by = $9
      WHERE id_product = $1
      RETURNING
        id_product, id_supplier, product_code, barcode, product_name, description,
        selling_price::float AS selling_price, minimum_stock, product_image, is_active;
      `,
      [idProduct, id_supplier, bar || null, name, desc || null, price, minStock, String(product_image || "").trim() || null, id_user]
    );
    if (result.rowCount === 0) throw new Error("Product not found.");
    await logActivity(client, req, {
      idUser: id_user,
      activityType: "UPDATE_PRODUCT",
      tableName: "tbl_products",
      recordId: result.rows[0].id_product,
      description: `Updated product ${result.rows[0].product_code}.`,
    });

    await client.query("COMMIT");
    if (previousProductImage && nextProductImage && previousProductImage !== nextProductImage) {
      try {
        removeUploadedProductImageIfAny(previousProductImage);
      } catch (cleanupError) {
        console.warn("Failed to remove previous product image:", cleanupError.message);
      }
    }
    res.json({ message: "Product updated successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to update product.", error: error.message });
  } finally {
    client.release();
  }
};

const setProductActiveState = async (req, res) => {
  const idProduct = String(req.params.idProduct || "").trim();
  const { id_user, is_active } = req.body || {};
  const nextState = String(is_active || "").trim().toUpperCase();

  if (!idProduct) return res.status(400).json({ message: "idProduct is required." });
  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!["Y", "N"].includes(nextState)) return res.status(400).json({ message: "is_active must be Y or N." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await getActiveUserRole(client, id_user);
    assertInventoryMasterRole(user.role_name);

    const result = await client.query(
      `
      UPDATE tbl_products
      SET
        is_active = $2,
        last_modify_date = NOW(),
        last_modify_by = $3
      WHERE id_product = $1
      RETURNING
        id_product, id_supplier, product_code, barcode, product_name, description,
        selling_price::float AS selling_price, minimum_stock, product_image, is_active;
      `,
      [idProduct, nextState, id_user]
    );
    if (result.rowCount === 0) throw new Error("Product not found.");
    await logActivity(client, req, {
      idUser: id_user,
      activityType: nextState === "Y" ? "ACTIVATE_PRODUCT" : "DEACTIVATE_PRODUCT",
      tableName: "tbl_products",
      recordId: result.rows[0].id_product,
      description: `${nextState === "Y" ? "Activated" : "Deactivated"} product ${result.rows[0].product_code}.`,
    });

    await client.query("COMMIT");
    res.json({ message: "Product status updated successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: "Failed to update product status.", error: error.message });
  } finally {
    client.release();
  }
};

const getProductBatchesByProduct = async (req, res) => {
  const idProduct = String(req.params.idProduct || "").trim();
  if (!idProduct) {
    return res.status(400).json({ message: "idProduct is required." });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        pb.id_product_batch,
        pb.batch_code,
        pb.expired_date,
        GREATEST(
          COALESCE(
            SUM(
              CASE
                WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                ELSE sm.quantity
              END
            ),
            0
          ),
          0
        )::int AS batch_qty
      FROM tbl_product_batches pb
      LEFT JOIN tbl_stock_movements sm
        ON sm.id_product_batch = pb.id_product_batch
       AND sm.is_active = 'Y'
      WHERE pb.id_product = $1
      GROUP BY pb.id_product_batch, pb.batch_code, pb.expired_date
      HAVING GREATEST(
        COALESCE(
          SUM(
            CASE
              WHEN sm.movement_type = 'OUT' THEN -sm.quantity
              ELSE sm.quantity
            END
          ),
          0
        ),
        0
      ) > 0
      ORDER BY pb.expired_date ASC, pb.created_date ASC;
      `,
      [idProduct]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch product batches.",
      error: error.message,
    });
  }
};


module.exports = {
  getProducts,
  createSupplier,
  updateSupplier,
  setSupplierActiveState,
  getBatches,
  getSuppliers,
  getProductsBySupplier,
  createProduct,
  uploadProductImage,
  updateProduct,
  setProductActiveState,
  getProductBatchesByProduct,
};

