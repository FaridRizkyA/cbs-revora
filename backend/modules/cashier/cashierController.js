const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const createSaleNumber = async (client) => {
  const seqResult = await client.query(
    `
    SELECT
      TO_CHAR(NOW(), 'YYYYMMDD') AS date_token,
      LPAD((COUNT(*) + 1)::text, 5, '0') AS seq
    FROM tbl_sales
    WHERE sale_date::date = CURRENT_DATE;
    `
  );
  const row = seqResult.rows[0];
  return `STO/${row.date_token}/S/${row.seq}`;
};

const createStockInCode = async (client) => {
  const seqResult = await client.query(
    `
    SELECT
      TO_CHAR(NOW(), 'YYYYMMDD') AS date_token,
      LPAD((COUNT(*) + 1)::text, 5, '0') AS seq
    FROM tbl_stock_in_headers
    WHERE stock_in_date::date = CURRENT_DATE;
    `
  );
  const row = seqResult.rows[0];
  return `STI/${row.date_token}/${row.seq}`;
};

const validatePositiveInteger = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return number;
};

const STOCK_MOVEMENT_ALLOWED_ROLES = new Set(["CASHIER", "STAFF", "ADMIN"]);
const CASHIER_CHECKOUT_ALLOWED_ROLES = new Set(["CASHIER", "STAFF", "ADMIN"]);
const INVENTORY_MASTER_ALLOWED_ROLES = new Set(["STAFF", "ADMIN"]);

const getActiveUserRole = async (client, idUser) => {
  const userResult = await client.query(
    `
    SELECT
      u.id_user,
      UPPER(TRIM(COALESCE(r.role_name, ''))) AS role_name
    FROM tbl_users u
    LEFT JOIN tbl_roles r
      ON r.id_role = u.id_role
    WHERE u.id_user = $1
      AND u.is_active = 'Y'
    LIMIT 1;
    `,
    [idUser]
  );

  if (userResult.rowCount === 0) {
    throw new Error("User not found or inactive.");
  }

  return userResult.rows[0];
};

const assertInventoryMasterRole = (roleName) => {
  if (!INVENTORY_MASTER_ALLOWED_ROLES.has(roleName)) {
    throw new Error("User role is not allowed to manage inventory master.");
  }
};

const PHONE_ALLOWED_PATTERN = /^[0-9+\-().\s/xX]{6,25}$/;

const validatePhoneNumber = (phoneRaw) => {
  const phone = String(phoneRaw || "").trim();
  if (!phone) return null;

  if (!PHONE_ALLOWED_PATTERN.test(phone)) {
    throw new Error("phone_number format is invalid.");
  }

  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < 6 || digitsOnly.length > 20) {
    throw new Error("phone_number digits length must be between 6 and 20.");
  }

  const plusCount = (phone.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !phone.startsWith("+"))) {
    throw new Error("phone_number format is invalid.");
  }

  return phone.replace(/\s{2,}/g, " ");
};

const generateNextSupplierCode = async (client) => {
  const result = await client.query(
    `
    SELECT
      COALESCE(
        MAX(
          CASE
            WHEN supplier_code ~ '^SUP-[0-9]+$'
              THEN CAST(SUBSTRING(supplier_code FROM 5) AS INTEGER)
            ELSE NULL
          END
        ),
        0
      ) AS max_seq
    FROM tbl_suppliers;
    `
  );
  const nextSeq = Number(result.rows[0]?.max_seq || 0) + 1;
  return `SUP-${String(nextSeq).padStart(3, "0")}`;
};

const buildProductCodeBaseFromName = (productNameRaw) => {
  const name = String(productNameRaw || "").trim().toUpperCase();
  const tokens = name.split(/\s+/).filter(Boolean);
  const consonantTokens = tokens
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .map((token) => {
      if (!token) return "";
      const first = token[0];
      const rest = token.slice(1).replace(/[AEIOU]/g, "");
      if (/[AEIOU]/.test(first)) return `${first}${rest}`;
      return token.replace(/[AEIOU]/g, "");
    })
    .filter(Boolean);
  const compact = consonantTokens.join("-");
  return `PRD-${compact || "ITEM"}`;
};

const generateNextProductCode = async (client, productName) => {
  const baseCode = buildProductCodeBaseFromName(productName);
  let attempt = 0;

  while (attempt < 9999) {
    const candidate = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
    const exists = await client.query(
      `SELECT 1 FROM tbl_products WHERE UPPER(TRIM(product_code)) = $1 LIMIT 1;`,
      [candidate]
    );
    if (exists.rowCount === 0) return candidate;
    attempt += 1;
  }

  throw new Error("Failed to generate unique product_code.");
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
      WITH in_qty AS (
        SELECT
          sm.id_product_batch,
          SUM(sm.quantity)::int AS qty_in
        FROM tbl_stock_movements sm
        WHERE sm.movement_type = 'IN'
          AND sm.is_active = 'Y'
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
          COALESCE(iq.qty_in, 0)::int AS qty_in
        FROM tbl_product_batches pb
        JOIN tbl_products p
          ON p.id_product = pb.id_product
        LEFT JOIN tbl_suppliers pr
          ON pr.id_supplier = p.id_supplier
        LEFT JOIN in_qty iq
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
          SUM(br.qty_in)::int AS qty_in
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
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'product_name', bi.product_name,
              'qty_in', bi.qty_in
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

const getStockMovements = async (req, res) => {
  const type = String(req.query.type || "").trim().toUpperCase();
  const search = String(req.query.search || "").trim();

  if (type && !["IN", "OUT", "ADJUSTMENT"].includes(type)) {
    return res.status(400).json({ message: "Invalid movement type." });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        sm.id_stock_movement,
        sm.id_product,
        sm.id_product_batch,
        sm.source_type,
        sm.source_id,
        sm.source_item_id,
        sm.movement_type,
        sm.quantity,
        sm.reason,
        sm.notes,
        sm.movement_date,
        sm.is_active,
        p.product_code,
        p.product_name,
        pb.batch_code,
        pb.purchase_price::float AS purchase_price,
        si.unit_price::float AS selling_price,
        CASE
          WHEN sm.movement_type = 'OUT' AND si.unit_price IS NOT NULL AND pb.purchase_price IS NOT NULL
            THEN ((si.unit_price - pb.purchase_price) * sm.quantity)::float
          ELSE NULL
        END AS profit_amount,
        COALESCE(pr.supplier_name, '-') AS supplier_name
      FROM tbl_stock_movements sm
      JOIN tbl_products p
        ON p.id_product = sm.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = sm.id_product_batch
      LEFT JOIN tbl_sale_items si
        ON si.id_sale_item = sm.source_item_id
       AND sm.source_type = 'SALE'
      LEFT JOIN tbl_suppliers pr
        ON pr.id_supplier = p.id_supplier
      WHERE sm.is_active = 'Y'
        AND ($1 = '' OR sm.movement_type = $1)
        AND (
          $2 = ''
          OR p.product_code ILIKE $3
          OR p.product_name ILIKE $3
          OR COALESCE(pb.batch_code, '') ILIKE $3
          OR COALESCE(sm.reason, '') ILIKE $3
          OR COALESCE(sm.notes, '') ILIKE $3
        )
      ORDER BY sm.movement_date DESC;
      `,
      [type, search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock movements.",
      error: error.message,
    });
  }
};

const getStockAdjustments = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      WITH adjustment_rows AS (
        SELECT
          sm.id_stock_movement,
          sm.id_product,
          sm.id_product_batch,
          p.product_code,
          p.product_name,
          pb.batch_code,
          pb.purchase_price::float AS buy_per_pcs,
          sm.movement_type,
          CASE
            WHEN sm.movement_type = 'IN' THEN 'INCREASE'
            WHEN sm.movement_type = 'OUT' THEN 'DECREASE'
            ELSE 'ADJUSTMENT'
          END AS adjustment_type,
          CASE
            WHEN sm.reason LIKE 'ADJUSTMENT_INCREASE:%' THEN REPLACE(sm.reason, 'ADJUSTMENT_INCREASE:', '')
            WHEN sm.reason LIKE 'ADJUSTMENT_DECREASE:%' THEN REPLACE(sm.reason, 'ADJUSTMENT_DECREASE:', '')
            WHEN sm.reason LIKE 'ADJUSTMENT:%' THEN REPLACE(sm.reason, 'ADJUSTMENT:', '')
            ELSE COALESCE(sm.reason, '')
          END AS adjustment_reason,
          sm.quantity,
          sm.reason,
          sm.notes,
          sm.movement_date,
          CASE
            WHEN sm.movement_type = 'OUT' THEN (COALESCE(pb.purchase_price, 0) * sm.quantity)::float
            ELSE 0::float
          END AS total_loss,
          sm.created_by AS operator_id,
          COALESCE(u.full_name, u.username, '-') AS operator_name,
          TO_CHAR(sm.movement_date, 'YYYYMMDD') AS date_token,
          CASE WHEN sm.movement_type = 'IN' THEN 'I' ELSE 'D' END AS type_token
        FROM tbl_stock_movements sm
        JOIN tbl_products p
          ON p.id_product = sm.id_product
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        LEFT JOIN tbl_users u
          ON u.id_user = sm.created_by
        WHERE sm.is_active = 'Y'
          AND (
            sm.reason LIKE 'ADJUSTMENT_INCREASE:%'
            OR sm.reason LIKE 'ADJUSTMENT_DECREASE:%'
            OR sm.reason LIKE 'ADJUSTMENT:%'
          )
      ),
      ranked AS (
        SELECT
          ar.*,
          ROW_NUMBER() OVER (
            PARTITION BY ar.date_token, ar.type_token
            ORDER BY ar.movement_date ASC, ar.id_stock_movement ASC
          ) AS sequence_no
        FROM adjustment_rows ar
      )
      SELECT
        r.id_stock_movement,
        r.id_product,
        r.id_product_batch,
        r.product_code,
        r.product_name,
        r.batch_code,
        r.buy_per_pcs,
        r.movement_type,
        r.adjustment_type,
        r.adjustment_reason,
        r.quantity,
        r.reason,
        r.notes,
        r.movement_date,
        r.total_loss,
        r.operator_id,
        r.operator_name,
        CONCAT('STA/', r.date_token, '/', r.type_token, '/', LPAD(r.sequence_no::text, 5, '0')) AS adjustment_code
      FROM ranked r
      WHERE (
          $1 = ''
          OR CONCAT('STA/', r.date_token, '/', r.type_token, '/', LPAD(r.sequence_no::text, 5, '0')) ILIKE $2
          OR r.product_code ILIKE $2
          OR r.product_name ILIKE $2
          OR COALESCE(r.adjustment_reason, '') ILIKE $2
          OR COALESCE(r.notes, '') ILIKE $2
          OR COALESCE(r.operator_name, '') ILIKE $2
        )
      ORDER BY r.movement_date DESC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock adjustments.",
      error: error.message,
    });
  }
};

const createStockAdjustment = async (req, res) => {
  const {
    id_user,
    id_product,
    id_product_batch,
    adjustment_type,
    quantity,
    notes,
  } = req.body || {};

  const normalizedType = String(adjustment_type || "").trim().toUpperCase();
  const normalizedNotes = String(notes || "").trim();
  const qty = Number(quantity || 0);

  if (!id_user) {
    return res.status(400).json({ message: "id_user is required." });
  }
  if (!id_product) {
    return res.status(400).json({ message: "id_product is required." });
  }
  if (!id_product_batch) {
    return res.status(400).json({ message: "id_product_batch is required." });
  }
  if (!["INCREASE", "DECREASE"].includes(normalizedType)) {
    return res.status(400).json({ message: "adjustment_type must be INCREASE or DECREASE." });
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ message: "quantity must be a positive integer." });
  }
  if (!normalizedNotes) {
    return res.status(400).json({ message: "notes is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getActiveUserRole(client, id_user);
    if (!STOCK_MOVEMENT_ALLOWED_ROLES.has(user.role_name)) {
      throw new Error("User role is not allowed to create stock adjustment.");
    }

    const productResult = await client.query(
      `
      SELECT
        p.id_product,
        p.product_code,
        p.product_name
      FROM tbl_products p
      WHERE p.id_product = $1
        AND p.is_active = 'Y'
      LIMIT 1;
      `,
      [id_product]
    );

    if (productResult.rowCount === 0) {
      throw new Error("Product not found or inactive.");
    }

    const product = productResult.rows[0];
    const batchResult = await client.query(
      `
      SELECT
        pb.id_product_batch,
        pb.batch_code,
        pb.purchase_price::float AS purchase_price,
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
        )::int AS available_qty
      FROM tbl_product_batches pb
      LEFT JOIN tbl_stock_movements sm
        ON sm.id_product_batch = pb.id_product_batch
       AND sm.is_active = 'Y'
      WHERE pb.id_product_batch = $1
        AND pb.id_product = $2
      GROUP BY pb.id_product_batch, pb.batch_code, pb.purchase_price
      LIMIT 1;
      `,
      [id_product_batch, id_product]
    );
    if (batchResult.rowCount === 0) {
      throw new Error("Selected batch not found for this product.");
    }

    const batch = batchResult.rows[0];
    const availableQty = Number(batch.available_qty || 0);
    if (normalizedType === "DECREASE" && qty > availableQty) {
      throw new Error(`Insufficient batch stock. Available in batch ${batch.batch_code}: ${availableQty}.`);
    }

    const movementType = normalizedType === "DECREASE" ? "OUT" : "IN";
    const reasonCode =
      normalizedType === "DECREASE"
        ? "ADJUSTMENT_DECREASE:STOCK_OPNAME_MINUS"
        : "ADJUSTMENT_INCREASE:STOCK_OPNAME_PLUS";

    const insertResult = await client.query(
      `
      INSERT INTO tbl_stock_movements (
        id_product,
        id_product_batch,
        movement_type,
        quantity,
        reason,
        notes,
        source_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ADJUSTMENT', $7)
      RETURNING id_stock_movement, movement_date;
      `,
      [id_product, id_product_batch, movementType, qty, reasonCode, normalizedNotes, id_user]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Stock adjustment created successfully.",
      data: {
        id_stock_movement: insertResult.rows[0].id_stock_movement,
        movement_date: insertResult.rows[0].movement_date,
        id_product: product.id_product,
        product_code: product.product_code,
        product_name: product.product_name,
        id_product_batch: batch.id_product_batch,
        batch_code: batch.batch_code,
        buy_per_pcs: Number(batch.purchase_price || 0),
        adjustment_type: normalizedType,
        quantity: qty,
        total_loss: normalizedType === "DECREASE" ? Number(batch.purchase_price || 0) * qty : 0,
        reason: reasonCode,
        notes: normalizedNotes,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({
      message: "Failed to create stock adjustment.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getStockInDocuments = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        h.id_stock_in,
        h.stock_in_code,
        h.stock_in_date,
        h.notes,
        h.id_supplier,
        h.created_by AS received_by_id,
        COALESCE(u.full_name, u.username, '-') AS received_by_name,
        COALESCE(pr.supplier_name, '-') AS supplier_name,
        COALESCE(
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.product_name), NULL),
          ARRAY[]::text[]
        ) AS product_names,
        COUNT(i.id_stock_in_item)::int AS item_count,
        COALESCE(SUM(i.quantity), 0)::int AS total_qty
      FROM tbl_stock_in_headers h
      LEFT JOIN tbl_suppliers pr
        ON pr.id_supplier = h.id_supplier
      LEFT JOIN tbl_users u
        ON u.id_user = h.created_by
      LEFT JOIN tbl_stock_in_items i
        ON i.id_stock_in = h.id_stock_in
      LEFT JOIN tbl_products p
        ON p.id_product = i.id_product
      WHERE (
        $1 = ''
        OR h.stock_in_code ILIKE $2
        OR COALESCE(pr.supplier_name, '') ILIKE $2
        OR COALESCE(h.notes, '') ILIKE $2
        OR COALESCE(p.product_name, '') ILIKE $2
      )
      GROUP BY
        h.id_stock_in,
        h.stock_in_code,
        h.stock_in_date,
        h.notes,
        h.id_supplier,
        h.created_by,
        u.full_name,
        u.username,
        pr.supplier_name
      ORDER BY h.stock_in_date DESC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock in documents.",
      error: error.message,
    });
  }
};

const getStockInDocumentById = async (req, res) => {
  const idStockIn = String(req.params.idStockIn || "").trim();
  if (!idStockIn) {
    return res.status(400).json({ message: "idStockIn is required." });
  }

  try {
    const headerResult = await pool.query(
      `
      SELECT
        h.id_stock_in,
        h.stock_in_code,
        h.stock_in_date,
        h.notes,
        h.id_supplier,
        h.created_by AS received_by_id,
        COALESCE(u.full_name, u.username, '-') AS received_by_name,
        COALESCE(pr.supplier_name, '-') AS supplier_name
      FROM tbl_stock_in_headers h
      LEFT JOIN tbl_suppliers pr
        ON pr.id_supplier = h.id_supplier
      LEFT JOIN tbl_users u
        ON u.id_user = h.created_by
      WHERE h.id_stock_in = $1
      LIMIT 1;
      `,
      [idStockIn]
    );

    if (headerResult.rowCount === 0) {
      return res.status(404).json({ message: "Stock in document not found." });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        i.id_stock_in_item,
        i.id_product,
        p.product_code,
        p.product_name,
        i.id_product_batch,
        pb.batch_code,
        pb.purchase_price::float AS purchase_price,
        i.quantity,
        i.expired_date
      FROM tbl_stock_in_items i
      JOIN tbl_products p
        ON p.id_product = i.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = i.id_product_batch
      WHERE i.id_stock_in = $1
      ORDER BY p.product_name ASC;
      `,
      [idStockIn]
    );

    res.json({
      data: {
        ...headerResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock in detail.",
      error: error.message,
    });
  }
};

const getStockOutDocuments = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      WITH sale_docs AS (
        SELECT
          s.id_sale AS id_stock_out,
          'SALE'::text AS stock_out_type,
          s.id_cashier,
          COALESCE(u.full_name, u.username, '-') AS cashier_name,
          s.sale_date AS stock_out_date,
          s.notes,
          COALESCE(
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.product_name), NULL),
            ARRAY[]::text[]
          ) AS product_names,
          COUNT(DISTINCT sm.id_stock_movement)::int AS item_count,
          COALESCE(SUM(sm.quantity), 0)::int AS total_qty,
          COALESCE(SUM(COALESCE(pb.purchase_price, 0) * sm.quantity), 0)::float AS total_buy,
          COALESCE(SUM(COALESCE(si.unit_price, 0) * sm.quantity), 0)::float AS total_sell,
          COALESCE(SUM((COALESCE(si.unit_price, 0) - COALESCE(pb.purchase_price, 0)) * sm.quantity), 0)::float AS total_profit,
          TO_CHAR(s.sale_date, 'YYYYMMDD') AS date_token
        FROM tbl_sales s
        LEFT JOIN tbl_users u
          ON u.id_user = s.id_cashier
        JOIN tbl_stock_movements sm
          ON sm.source_type = 'SALE'
         AND sm.source_id = s.id_sale
         AND sm.movement_type = 'OUT'
         AND sm.is_active = 'Y'
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        LEFT JOIN tbl_sale_items si
          ON si.id_sale_item = sm.source_item_id
        LEFT JOIN tbl_products p
          ON p.id_product = sm.id_product
        GROUP BY s.id_sale, s.sale_date, s.notes, s.id_cashier, u.full_name, u.username
      ),
      ranked AS (
        SELECT
          sd.*,
          ROW_NUMBER() OVER (
            PARTITION BY sd.date_token
            ORDER BY sd.stock_out_date ASC, sd.id_stock_out ASC
          ) AS sequence_no
        FROM sale_docs sd
      )
      SELECT
        r.id_stock_out,
        CONCAT('STO/', r.date_token, '/S/', LPAD(r.sequence_no::text, 5, '0')) AS stock_out_code,
        r.stock_out_type,
        r.id_cashier,
        r.cashier_name,
        r.stock_out_date,
        r.notes,
        r.product_names,
        r.item_count,
        r.total_qty,
        r.total_buy,
        r.total_sell,
        r.total_profit
      FROM ranked r
      WHERE (
        $1 = ''
        OR CONCAT('STO/', r.date_token, '/S/', LPAD(r.sequence_no::text, 5, '0')) ILIKE $2
        OR COALESCE(r.notes, '') ILIKE $2
        OR EXISTS (
          SELECT 1
          FROM UNNEST(r.product_names) AS pn(name)
          WHERE pn.name ILIKE $2
        )
      )
      ORDER BY r.stock_out_date DESC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock out documents.",
      error: error.message,
    });
  }
};

const getStockOutDocumentById = async (req, res) => {
  const idStockOut = String(req.params.idStockOut || "").trim();
  if (!idStockOut) {
    return res.status(400).json({ message: "idStockOut is required." });
  }

  try {
    const headerResult = await pool.query(
      `
      WITH sale_docs AS (
        SELECT
          s.id_sale AS id_stock_out,
          'SALE'::text AS stock_out_type,
          s.id_cashier,
          COALESCE(u.full_name, u.username, '-') AS cashier_name,
          s.sale_date AS stock_out_date,
          s.notes,
          COALESCE(SUM(sm.quantity), 0)::int AS total_qty,
          COALESCE(SUM(COALESCE(pb.purchase_price, 0) * sm.quantity), 0)::float AS total_buy,
          COALESCE(SUM(COALESCE(si.unit_price, 0) * sm.quantity), 0)::float AS total_sell,
          COALESCE(SUM((COALESCE(si.unit_price, 0) - COALESCE(pb.purchase_price, 0)) * sm.quantity), 0)::float AS total_profit,
          TO_CHAR(s.sale_date, 'YYYYMMDD') AS date_token
        FROM tbl_sales s
        LEFT JOIN tbl_users u
          ON u.id_user = s.id_cashier
        LEFT JOIN tbl_stock_movements sm
          ON sm.source_type = 'SALE'
         AND sm.source_id = s.id_sale
         AND sm.movement_type = 'OUT'
         AND sm.is_active = 'Y'
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        LEFT JOIN tbl_sale_items si
          ON si.id_sale_item = sm.source_item_id
        GROUP BY s.id_sale, s.sale_date, s.notes, s.id_cashier, u.full_name, u.username
      ),
      ranked AS (
        SELECT
          sd.*,
          ROW_NUMBER() OVER (
            PARTITION BY sd.date_token
            ORDER BY sd.stock_out_date ASC, sd.id_stock_out ASC
          ) AS sequence_no
        FROM sale_docs sd
      )
      SELECT
        r.id_stock_out,
        CONCAT('STO/', r.date_token, '/S/', LPAD(r.sequence_no::text, 5, '0')) AS stock_out_code,
        r.stock_out_type,
        r.id_cashier,
        r.cashier_name,
        r.stock_out_date,
        r.notes,
        r.total_qty,
        r.total_buy,
        r.total_sell,
        r.total_profit
      FROM ranked r
      WHERE r.id_stock_out = $1
      LIMIT 1;
      `,
      [idStockOut]
    );

    if (headerResult.rowCount === 0) {
      return res.status(404).json({ message: "Stock out document not found." });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        sm.id_stock_movement,
        p.product_code,
        p.product_name,
        pb.batch_code,
        sm.quantity,
        pb.purchase_price::float AS buy_per_pcs,
        si.unit_price::float AS sell_per_pcs,
        (COALESCE(pb.purchase_price, 0) * sm.quantity)::float AS total_buy,
        (COALESCE(si.unit_price, 0) * sm.quantity)::float AS total_sell,
        ((COALESCE(si.unit_price, 0) - COALESCE(pb.purchase_price, 0)) * sm.quantity)::float AS profit
      FROM tbl_stock_movements sm
      JOIN tbl_products p
        ON p.id_product = sm.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = sm.id_product_batch
      LEFT JOIN tbl_sale_items si
        ON si.id_sale_item = sm.source_item_id
      WHERE sm.source_type = 'SALE'
        AND sm.source_id = $1
        AND sm.movement_type = 'OUT'
        AND sm.is_active = 'Y'
      ORDER BY p.product_name ASC, pb.expired_date ASC NULLS LAST, pb.created_date ASC;
      `,
      [idStockOut]
    );

    res.json({
      data: {
        ...headerResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock out detail.",
      error: error.message,
    });
  }
};

const getStockOutManualDocuments = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      WITH manual_docs AS (
        SELECT
          sm.source_id AS id_stock_out_manual,
          MIN(sm.movement_date) AS stock_out_date,
          REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', '') AS stock_out_type,
          MAX(sm.reason) AS reason,
          MAX(sm.notes) AS notes,
          COUNT(DISTINCT sm.id_stock_movement)::int AS item_count,
          COALESCE(SUM(sm.quantity), 0)::int AS total_qty,
          COALESCE(u.full_name, u.username, '-') AS operator_name,
          COALESCE(
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.product_name), NULL),
            ARRAY[]::text[]
          ) AS product_names,
          TO_CHAR(MIN(sm.movement_date), 'YYYYMMDD') AS date_token,
          UPPER(LEFT(REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', ''), 1)) AS type_token
        FROM tbl_stock_movements sm
        JOIN tbl_products p
          ON p.id_product = sm.id_product
        LEFT JOIN tbl_users u
          ON u.id_user = sm.created_by
        WHERE sm.is_active = 'Y'
          AND sm.source_type = 'NON_SALE_OUT'
          AND sm.movement_type = 'OUT'
        GROUP BY sm.source_id, u.full_name, u.username
      ),
      ranked AS (
        SELECT
          md.*,
          ROW_NUMBER() OVER (
            PARTITION BY md.date_token, md.type_token
            ORDER BY md.stock_out_date ASC, md.id_stock_out_manual ASC
          ) AS sequence_no
        FROM manual_docs md
      )
      SELECT
        r.id_stock_out_manual,
        CONCAT('STO/', r.date_token, '/', r.type_token, '/', LPAD(r.sequence_no::text, 5, '0')) AS stock_out_code,
        r.stock_out_type,
        r.stock_out_date,
        r.reason,
        r.notes,
        r.item_count,
        r.total_qty,
        r.operator_name,
        r.product_names
      FROM ranked r
      WHERE (
          $1 = ''
          OR CONCAT('STO/', r.date_token, '/', r.type_token, '/', LPAD(r.sequence_no::text, 5, '0')) ILIKE $2
          OR EXISTS (
            SELECT 1
            FROM UNNEST(r.product_names) AS pn(name)
            WHERE pn.name ILIKE $2
          )
          OR COALESCE(r.notes, '') ILIKE $2
          OR COALESCE(r.operator_name, '') ILIKE $2
        )
      ORDER BY r.stock_out_date DESC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch non-sales stock out documents.",
      error: error.message,
    });
  }
};

const getStockOutManualDocumentById = async (req, res) => {
  const idStockOutManual = String(req.params.idStockOutManual || "").trim();
  if (!idStockOutManual) {
    return res.status(400).json({ message: "idStockOutManual is required." });
  }

  try {
    const headerResult = await pool.query(
      `
      WITH manual_docs AS (
        SELECT
          sm.source_id AS id_stock_out_manual,
          MIN(sm.movement_date) AS stock_out_date,
          REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', '') AS stock_out_type,
          MAX(sm.notes) AS notes,
          COALESCE(SUM(sm.quantity), 0)::int AS total_qty,
          COALESCE(u.full_name, u.username, '-') AS operator_name,
          TO_CHAR(MIN(sm.movement_date), 'YYYYMMDD') AS date_token,
          UPPER(LEFT(REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', ''), 1)) AS type_token
        FROM tbl_stock_movements sm
        LEFT JOIN tbl_users u
          ON u.id_user = sm.created_by
        WHERE sm.source_type = 'NON_SALE_OUT'
          AND sm.movement_type = 'OUT'
          AND sm.is_active = 'Y'
        GROUP BY sm.source_id, u.full_name, u.username
      ),
      ranked AS (
        SELECT
          md.*,
          ROW_NUMBER() OVER (
            PARTITION BY md.date_token, md.type_token
            ORDER BY md.stock_out_date ASC, md.id_stock_out_manual ASC
          ) AS sequence_no
        FROM manual_docs md
      )
      SELECT
        r.id_stock_out_manual,
        CONCAT('STO/', r.date_token, '/', r.type_token, '/', LPAD(r.sequence_no::text, 5, '0')) AS stock_out_code,
        r.stock_out_type,
        r.stock_out_date,
        r.notes,
        r.total_qty,
        r.operator_name
      FROM ranked r
      WHERE r.id_stock_out_manual = $1
      LIMIT 1;
      `,
      [idStockOutManual]
    );

    if (headerResult.rowCount === 0) {
      return res.status(404).json({ message: "Non-sales stock out document not found." });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        sm.id_stock_movement,
        p.product_code,
        p.product_name,
        pb.batch_code,
        sm.quantity,
        pb.purchase_price::float AS buy_per_pcs,
        (COALESCE(pb.purchase_price, 0) * sm.quantity)::float AS total_buy,
        sm.reason,
        sm.notes
      FROM tbl_stock_movements sm
      JOIN tbl_products p
        ON p.id_product = sm.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = sm.id_product_batch
      WHERE sm.source_type = 'NON_SALE_OUT'
        AND sm.source_id = $1
        AND sm.movement_type = 'OUT'
        AND sm.is_active = 'Y'
      ORDER BY p.product_name ASC, pb.expired_date ASC NULLS LAST, pb.created_date ASC;
      `,
      [idStockOutManual]
    );

    res.json({
      data: {
        ...headerResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch non-sales stock out detail.",
      error: error.message,
    });
  }
};

const createStockOutManual = async (req, res) => {
  const { id_user, reason, notes, items, return_refund } = req.body || {};
  const normalizedReason = String(reason || "").trim().toUpperCase();
  const normalizedNotes = String(notes || "").trim();
  const allowedManualReasons = new Set(["DAMAGED", "EXPIRED", "RETURN_TO_SUPPLIER", "LOST", "DONATION", "OTHER"]);
  let finalizedReason = normalizedReason;

  if (normalizedReason === "RETURN_TO_SUPPLIER") {
    if (typeof return_refund !== "boolean") {
      return res.status(400).json({ message: "return_refund must be boolean for RETURN_TO_SUPPLIER." });
    }
    finalizedReason = return_refund ? "RETURN_TO_SUPPLIER_REFUND" : "RETURN_TO_SUPPLIER_NO_REFUND";
  }

  if (!id_user) return res.status(400).json({ message: "id_user is required." });
  if (!normalizedReason) return res.status(400).json({ message: "reason is required." });
  if (!allowedManualReasons.has(normalizedReason)) {
    return res.status(400).json({ message: "reason is invalid for manual stock out." });
  }
  if (!normalizedNotes) return res.status(400).json({ message: "notes is required." });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must contain at least one item." });
  }

  const dedupProduct = new Set();
  for (const item of items) {
    if (!item?.id_product) return res.status(400).json({ message: "Each item must include id_product." });
    const qty = Number(item.quantity || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: "Each item quantity must be a positive integer." });
    }
    if (dedupProduct.has(item.id_product)) {
      return res.status(400).json({ message: "Duplicate product is not allowed in one stock out transaction." });
    }
    dedupProduct.add(item.id_product);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await getActiveUserRole(client, id_user);
    if (!STOCK_MOVEMENT_ALLOWED_ROLES.has(user.role_name)) {
      throw new Error("User role is not allowed to create manual stock out.");
    }

    const sourceId = (await client.query(`SELECT gen_random_uuid()::text AS source_id;`)).rows[0].source_id;
    const insertedItems = [];

    for (const item of items) {
      const idProduct = String(item.id_product);
      const requestedQuantity = Number(item.quantity);
      const selectedBatchId = String(item.id_product_batch || "").trim();

      const productResult = await client.query(
        `
        SELECT
          p.id_product,
          p.product_code,
          p.product_name,
          GREATEST(
            COALESCE(
              SUM(CASE WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE sm.quantity END),
              0
            ),
            0
          )::int AS available_stock
        FROM tbl_products p
        LEFT JOIN tbl_stock_movements sm
          ON sm.id_product = p.id_product
         AND sm.is_active = 'Y'
        WHERE p.id_product = $1
          AND p.is_active = 'Y'
        GROUP BY p.id_product, p.product_code, p.product_name
        LIMIT 1;
        `,
        [idProduct]
      );
      if (productResult.rowCount === 0) throw new Error("Product not found or inactive.");

      const product = productResult.rows[0];
      const availableStock = Number(product.available_stock || 0);
      if (requestedQuantity > availableStock) {
        throw new Error(`Insufficient stock for ${product.product_name}. Available: ${availableStock}.`);
      }

      if (selectedBatchId) {
        const batchResult = await client.query(
          `
          SELECT
            pb.id_product_batch,
            pb.batch_code,
            GREATEST(
              COALESCE(
                SUM(CASE WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE sm.quantity END),
                0
              ),
              0
            )::int AS available_qty
          FROM tbl_product_batches pb
          LEFT JOIN tbl_stock_movements sm
            ON sm.id_product_batch = pb.id_product_batch
           AND sm.is_active = 'Y'
          WHERE pb.id_product = $1
            AND pb.id_product_batch = $2
          GROUP BY pb.id_product_batch, pb.batch_code
          LIMIT 1;
          `,
          [idProduct, selectedBatchId]
        );
        if (batchResult.rowCount === 0) {
          throw new Error(`Selected batch is invalid for ${product.product_name}.`);
        }

        const selectedBatch = batchResult.rows[0];
        const availableBatchQty = Number(selectedBatch.available_qty || 0);
        if (requestedQuantity > availableBatchQty) {
          throw new Error(`Insufficient stock in selected batch ${selectedBatch.batch_code}. Available: ${availableBatchQty}.`);
        }

        const insertResult = await client.query(
          `
          INSERT INTO tbl_stock_movements (
            id_product,
            id_product_batch,
            movement_type,
            quantity,
            reason,
            notes,
            source_type,
            source_id,
            created_by
          ) VALUES ($1, $2, 'OUT', $3, $4, $5, 'NON_SALE_OUT', $6, $7)
          RETURNING id_stock_movement;
          `,
          [idProduct, selectedBatch.id_product_batch, requestedQuantity, `NON_SALE_OUT:${finalizedReason}`, normalizedNotes, sourceId, id_user]
        );

        insertedItems.push({
          id_stock_movement: insertResult.rows[0].id_stock_movement,
          id_product: idProduct,
          product_code: product.product_code,
          product_name: product.product_name,
          batch_code: selectedBatch.batch_code,
          quantity: requestedQuantity,
        });
      } else {
        const batchesResult = await client.query(
          `
          SELECT
            pb.id_product_batch,
            pb.batch_code,
            GREATEST(
              COALESCE(
                SUM(CASE WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE sm.quantity END),
                0
              ),
              0
            )::int AS available_qty
          FROM tbl_product_batches pb
          LEFT JOIN tbl_stock_movements sm
            ON sm.id_product_batch = pb.id_product_batch
           AND sm.is_active = 'Y'
          WHERE pb.id_product = $1
          GROUP BY pb.id_product_batch, pb.batch_code, pb.expired_date, pb.created_date
          HAVING GREATEST(
            COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE sm.quantity END), 0),
            0
          ) > 0
          ORDER BY pb.expired_date ASC NULLS LAST, pb.created_date ASC;
          `,
          [idProduct]
        );

        let remaining = requestedQuantity;
        for (const batch of batchesResult.rows) {
          if (remaining <= 0) break;
          const takeQty = Math.min(remaining, Number(batch.available_qty || 0));
          if (takeQty <= 0) continue;

          const insertResult = await client.query(
            `
            INSERT INTO tbl_stock_movements (
              id_product,
              id_product_batch,
              movement_type,
              quantity,
              reason,
              notes,
              source_type,
              source_id,
              created_by
            ) VALUES ($1, $2, 'OUT', $3, $4, $5, 'NON_SALE_OUT', $6, $7)
            RETURNING id_stock_movement;
            `,
            [idProduct, batch.id_product_batch, takeQty, `NON_SALE_OUT:${finalizedReason}`, normalizedNotes, sourceId, id_user]
          );

          insertedItems.push({
            id_stock_movement: insertResult.rows[0].id_stock_movement,
            id_product: idProduct,
            product_code: product.product_code,
            product_name: product.product_name,
            batch_code: batch.batch_code,
            quantity: takeQty,
          });
          remaining -= takeQty;
        }

        if (remaining > 0) {
          throw new Error(`Failed to allocate batch stock for ${product.product_name}.`);
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      message: "Non-sales stock out created successfully.",
      data: {
        id_stock_out_manual: sourceId,
        stock_out_type: finalizedReason,
        reason: finalizedReason,
        notes: normalizedNotes,
        items: insertedItems,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({
      message: "Failed to create non-sales stock out.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const formatBatchDatePart = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

const toProductKey = (productCodeRaw, productNameRaw) => {
  const fromCode = String(productCodeRaw || "")
    .trim()
    .toUpperCase()
    .replace(/^PRD-/, "")
    .replace(/[^A-Z0-9-]/g, "");

  if (fromCode) {
    return fromCode.slice(0, 24);
  }

  const fromName = String(productNameRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);

  return fromName || "ITEM";
};

const createBatchCode = async (client, { idProduct, productCode, productName, now = new Date() }) => {
  const datePart = formatBatchDatePart(now);
  const productKey = toProductKey(productCode, productName);
  const prefix = `BATCH/${datePart}/${productKey}/`;

  const sequenceResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tbl_product_batches
    WHERE id_product = $1
      AND batch_code LIKE $2;
    `,
    [idProduct, `${prefix}%`]
  );

  const nextSequence = Number(sequenceResult.rows[0]?.total || 0) + 1;
  const sequencePart = String(nextSequence).padStart(3, "0");
  return `${prefix}${sequencePart}`;
};

const createStockIn = async (req, res) => {
  const { id_user, id_supplier, notes, items } = req.body;

  if (!id_user) {
    return res.status(400).json({ message: "id_user is required." });
  }
  if (!id_supplier) {
    return res.status(400).json({ message: "id_supplier is required." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must contain at least one row." });
  }

  const dedup = new Set();
  for (const item of items) {
    if (!item?.id_product) {
      return res.status(400).json({ message: "Each item must include id_product." });
    }

    const qty = Number(item.quantity || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: "Each item quantity must be a positive integer." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.expired_date || ""))) {
      return res.status(400).json({ message: "Each item expired_date must use YYYY-MM-DD format." });
    }
    const expiredAt = new Date(`${String(item.expired_date)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(expiredAt.getTime()) || expiredAt <= today) {
      return res.status(400).json({ message: "Each item expired_date must be after today." });
    }

    const purchasePrice = Number(item.purchase_price || 0);
    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      return res.status(400).json({ message: "Each item purchase_price must be greater than 0." });
    }

    if (dedup.has(item.id_product)) {
      return res.status(400).json({ message: "Duplicate product is not allowed in one stock in transaction." });
    }
    dedup.add(item.id_product);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getActiveUserRole(client, id_user);
    if (!STOCK_MOVEMENT_ALLOWED_ROLES.has(user.role_name)) {
      throw new Error("User role is not allowed to create stock in.");
    }

    const supplierResult = await client.query(
      `
      SELECT id_supplier
      FROM tbl_suppliers
      WHERE id_supplier = $1
        AND is_active = 'Y';
      `,
      [id_supplier]
    );

    if (supplierResult.rowCount === 0) {
      throw new Error("Supplier not found or inactive.");
    }

    const stockInCode = await createStockInCode(client);
    const stockInHeaderResult = await client.query(
      `
      INSERT INTO tbl_stock_in_headers (
        stock_in_code,
        id_supplier,
        stock_in_date,
        notes,
        created_by
      ) VALUES ($1, $2, NOW(), $3, $4)
      RETURNING id_stock_in, stock_in_code, stock_in_date;
      `,
      [stockInCode, id_supplier, notes || null, id_user]
    );
    const stockInHeader = stockInHeaderResult.rows[0];

    const insertedRows = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const qty = Number(item.quantity);
      const itemExpiredDate = String(item.expired_date);
      const itemPurchasePrice = Number(item.purchase_price);

      const productResult = await client.query(
        `
        SELECT
          id_product,
          id_supplier,
          product_code,
          product_name
        FROM tbl_products
        WHERE id_product = $1
          AND is_active = 'Y'
        FOR UPDATE;
        `,
        [item.id_product]
      );

      if (productResult.rowCount === 0) {
        throw new Error(`Product not found or inactive: ${item.id_product}`);
      }

      const product = productResult.rows[0];
      if (product.id_supplier !== id_supplier) {
        throw new Error(`Product ${product.product_name} does not belong to selected Supplier.`);
      }

      const batchCode = await createBatchCode(client, {
        idProduct: product.id_product,
        productCode: product.product_code,
        productName: product.product_name,
      });

      const batchResult = await client.query(
        `
        INSERT INTO tbl_product_batches (
          id_product,
          batch_code,
          expired_date,
          purchase_price,
          created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id_product_batch,
          batch_code,
          expired_date;
        `,
        [product.id_product, batchCode, itemExpiredDate, itemPurchasePrice, id_user]
      );

      const batch = batchResult.rows[0];

      const stockInItemResult = await client.query(
        `
        INSERT INTO tbl_stock_in_items (
          id_stock_in,
          id_product,
          id_product_batch,
          quantity,
          expired_date,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
        RETURNING id_stock_in_item;
        `,
        [
          stockInHeader.id_stock_in,
          product.id_product,
          batch.id_product_batch,
          qty,
          itemExpiredDate,
          id_user,
        ]
      );
      const stockInItem = stockInItemResult.rows[0];

      await client.query(
        `
        INSERT INTO tbl_stock_movements (
          id_product,
          id_product_batch,
          movement_type,
          quantity,
          reason,
          notes,
          source_type,
          source_id,
          source_item_id,
          created_by
        ) VALUES (
          $1, $2, 'IN', $3, $4, $5, $6, $7, $8, $9
        );
        `,
        [
          product.id_product,
          batch.id_product_batch,
          qty,
          "STOCK_IN",
          notes || `Stock in ${batch.batch_code}`,
          "STOCK_IN",
          stockInHeader.id_stock_in,
          stockInItem.id_stock_in_item,
          id_user,
        ]
      );

      insertedRows.push({
        id_stock_in: stockInHeader.id_stock_in,
        stock_in_code: stockInHeader.stock_in_code,
        id_stock_in_item: stockInItem.id_stock_in_item,
        id_product: product.id_product,
        product_name: product.product_name,
        id_product_batch: batch.id_product_batch,
        batch_code: batch.batch_code,
        quantity: qty,
        expired_date: itemExpiredDate,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Stock in created successfully.",
      data: {
        id_stock_in: stockInHeader.id_stock_in,
        stock_in_code: stockInHeader.stock_in_code,
        stock_in_date: stockInHeader.stock_in_date,
        id_supplier,
        notes: notes || null,
        items: insertedRows,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({
      message: "Failed to create stock in.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getSuppliers = async (req, res) => {
  const search = String(req.query.search || "").trim();

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
      WHERE (
        $1 = ''
        OR pr.supplier_code ILIKE $2
        OR pr.supplier_name ILIKE $2
        OR pr.city ILIKE $2
        OR pr.phone_number ILIKE $2
      )
      ORDER BY pr.supplier_name ASC;
      `,
      [search, `%${search}%`]
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
      WHERE p.id_supplier = $1
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

    const supplierResult = await client.query(
      `SELECT id_supplier FROM tbl_suppliers WHERE id_supplier = $1 AND is_active = 'Y' LIMIT 1;`,
      [id_supplier]
    );
    if (supplierResult.rowCount === 0) throw new Error("Supplier not found or inactive.");
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

    const supplierResult = await client.query(
      `SELECT id_supplier FROM tbl_suppliers WHERE id_supplier = $1 AND is_active = 'Y' LIMIT 1;`,
      [id_supplier]
    );
    if (supplierResult.rowCount === 0) throw new Error("Supplier not found or inactive.");

    if (bar) {
      const barcodeExists = await client.query(
        `SELECT 1 FROM tbl_products WHERE TRIM(COALESCE(barcode, '')) = $1 AND id_product <> $2 LIMIT 1;`,
        [bar, idProduct]
      );
      if (barcodeExists.rowCount > 0) throw new Error("barcode already exists.");
    }

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

const getMembers = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        m.id_member,
        m.id_user,
        m.member_code,
        m.full_name,
        m.phone_number,
        m.address,
        m.join_date,
        m.shopping_balance::float AS shopping_balance,
        m.total_spending::float AS total_spending,
        u.username,
        u.email
      FROM tbl_members m
      LEFT JOIN tbl_users u
        ON u.id_user = m.id_user
      WHERE m.is_active = 'Y'
        AND (
          $1 = ''
          OR m.member_code ILIKE $2
          OR m.full_name ILIKE $2
          OR m.phone_number ILIKE $2
          OR u.username ILIKE $2
          OR u.email ILIKE $2
        )
      ORDER BY m.full_name ASC
      LIMIT 25;
      `,
      [search, `%${search}%`]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch members.",
      error: error.message,
    });
  }
};

const lockProduct = async (client, idProduct) => {
  const result = await client.query(
    `
    SELECT
      id_product,
      product_code,
      product_name,
      selling_price::float AS selling_price
    FROM tbl_products
    WHERE id_product = $1
      AND is_active = 'Y'
    FOR UPDATE;
    `,
    [idProduct]
  );

  if (result.rowCount === 0) {
    throw new Error(`Product not found or inactive: ${idProduct}`);
  }

  return result.rows[0];
};

const getAvailableBatches = async (client, idProduct) => {
  const result = await client.query(
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
      )::int AS available_qty
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
    ORDER BY pb.expired_date ASC NULLS LAST, pb.created_date ASC;
    `,
    [idProduct]
  );

  return result.rows;
};

const checkoutSale = async (req, res) => {
  const {
    id_cashier,
    id_member,
    payment_method,
    amount_paid,
    discount_amount = 0,
    notes,
    items,
  } = req.body;

  if (!id_cashier) {
    return res.status(400).json({ message: "id_cashier is required." });
  }

  if (!["CASH", "QRIS"].includes(payment_method)) {
    return res.status(400).json({ message: "payment_method must be CASH or QRIS." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must contain at least one item." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cashier = await getActiveUserRole(client, id_cashier);
    if (!CASHIER_CHECKOUT_ALLOWED_ROLES.has(cashier.role_name)) {
      throw new Error("User role is not allowed to perform checkout.");
    }

    let member = null;

    if (id_member) {
      const memberResult = await client.query(
        `
        SELECT id_member
        FROM tbl_members
        WHERE id_member = $1
          AND is_active = 'Y';
        `,
        [id_member]
      );

      if (memberResult.rowCount === 0) {
        throw new Error("Member not found or inactive.");
      }

      member = memberResult.rows[0];
    }

    const saleItems = [];

    for (const item of items) {
      if (!item.id_product) {
        throw new Error("Each item must include id_product.");
      }

      const product = await lockProduct(client, item.id_product);
      const requestedQuantity = validatePositiveInteger(item.quantity || 1, "quantity");
      const unitPrice = toNumber(item.unit_price ?? product.selling_price);

      if (unitPrice < 0) {
        throw new Error(`unit_price cannot be negative for product: ${item.id_product}`);
      }

      const availableBatches = await getAvailableBatches(client, item.id_product);
      const availableStock = availableBatches.reduce(
        (sum, batch) => sum + Number(batch.available_qty || 0),
        0
      );

      if (requestedQuantity > availableStock) {
        throw new Error(
          `Insufficient stock for product ${product.product_name}. Available: ${availableStock}.`
        );
      }

      let remainingQty = requestedQuantity;
      for (const batch of availableBatches) {
        if (remainingQty <= 0) break;
        const takeQty = Math.min(remainingQty, Number(batch.available_qty || 0));
        if (takeQty <= 0) continue;

        saleItems.push({
          id_product: product.id_product,
          id_product_batch: batch.id_product_batch,
          quantity: takeQty,
          unit_price: unitPrice,
          subtotal: unitPrice * takeQty,
        });

        remainingQty -= takeQty;
      }

      if (remainingQty > 0) {
        throw new Error(`Failed to allocate batch stock for product ${product.product_name}.`);
      }
    }

    const subtotal = saleItems.reduce((total, item) => total + item.subtotal, 0);

    const discount = toNumber(discount_amount);
    const totalAmount = subtotal - discount;
    const paidAmount = toNumber(amount_paid);
    const changeAmount = paidAmount - totalAmount;

    if (discount < 0) {
      throw new Error("discount_amount cannot be negative.");
    }

    if (totalAmount < 0) {
      throw new Error("discount_amount cannot exceed subtotal.");
    }

    if (paidAmount < totalAmount) {
      throw new Error("amount_paid cannot be less than total_amount.");
    }

    const saleNumber = await createSaleNumber(client);

    const saleResult = await client.query(
      `
      INSERT INTO tbl_sales (
        sale_number,
        id_member,
        id_cashier,
        customer_type,
        subtotal,
        discount_amount,
        total_amount,
        payment_method,
        amount_paid,
        change_amount,
        notes,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING
        id_sale,
        sale_number,
        sale_date,
        subtotal::float AS subtotal,
        discount_amount::float AS discount_amount,
        total_amount::float AS total_amount,
        amount_paid::float AS amount_paid,
        change_amount::float AS change_amount;
      `,
      [
        saleNumber,
        member ? member.id_member : null,
        id_cashier,
        member ? "MEMBER" : "GENERAL",
        subtotal,
        discount,
        totalAmount,
        payment_method,
        paidAmount,
        changeAmount,
        notes || null,
        id_cashier,
      ]
    );

    const sale = saleResult.rows[0];
    const insertedItems = [];

    for (const item of saleItems) {
      const saleItemResult = await client.query(
        `
        INSERT INTO tbl_sale_items (
          id_sale,
          id_product,
          id_product_batch,
          quantity,
          unit_price,
          subtotal,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        RETURNING
          id_sale_item,
          id_product,
          id_product_batch,
          quantity,
          unit_price::float AS unit_price,
          subtotal::float AS subtotal;
        `,
        [
          sale.id_sale,
          item.id_product,
          item.id_product_batch,
          item.quantity,
          item.unit_price,
          item.subtotal,
          id_cashier,
        ]
      );

      insertedItems.push(saleItemResult.rows[0]);

      await client.query(
        `
        INSERT INTO tbl_stock_movements (
          id_product,
          id_product_batch,
          movement_type,
          quantity,
          reason,
          notes,
          source_type,
          source_id,
          source_item_id,
          created_by
        ) VALUES (
          $1, $2, 'OUT', $3, $4, $5, $6, $7, $8, $9
        );
        `,
        [
          item.id_product,
          item.id_product_batch,
          item.quantity,
          "SALE",
          `Sale ${sale.sale_number}`,
          "SALE",
          sale.id_sale,
          saleItemResult.rows[0].id_sale_item,
          id_cashier,
        ]
      );
    }

    if (member) {
      await client.query(
        `
        UPDATE tbl_members
        SET
          total_spending = total_spending + $2,
          last_modify_date = NOW(),
          last_modify_by = $3
        WHERE id_member = $1;
        `,
        [member.id_member, totalAmount, id_cashier]
      );
    }

    await client.query(
      `
      INSERT INTO tbl_activity_logs (
        id_user,
        activity_type,
        table_name,
        record_id,
        description,
        ip_address,
        user_agent,
        created_by
      ) VALUES (
        $1, 'SALE_CHECKOUT', 'tbl_sales', $2, $3, $4, $5, $1
      );
      `,
      [
        id_cashier,
        sale.id_sale,
        `Checkout sale ${sale.sale_number} with ${insertedItems.length} item row(s).`,
        req.ip,
        req.get("user-agent") || null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Checkout completed successfully.",
      data: {
        ...sale,
        id_member: member ? member.id_member : null,
        id_cashier,
        customer_type: member ? "MEMBER" : "GENERAL",
        payment_method,
        items: insertedItems,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    res.status(400).json({
      message: "Checkout failed.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createProduct,
  createSupplier,
  createStockAdjustment,
  createStockOutManual,
  createStockIn,
  checkoutSale,
  getBatches,
  getMembers,
  getStockAdjustments,
  getStockInDocumentById,
  getStockInDocuments,
  getStockOutManualDocumentById,
  getStockOutManualDocuments,
  getStockOutDocuments,
  getStockOutDocumentById,
  getProductsBySupplier,
  getProductBatchesByProduct,
  getSuppliers,
  setProductActiveState,
  setSupplierActiveState,
  uploadProductImage,
  updateProduct,
  updateSupplier,
  getProducts,
  getStockMovements,
};

