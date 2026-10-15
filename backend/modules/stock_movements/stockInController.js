// Stock in documents and their batches.
const pool = require("../../config/db");
const { createStockInCode } = require("../sales/shared/numbering");
const { logActivity } = require("../../utils/activityLogger");

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
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS received_by_name,
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
      LEFT JOIN tbl_profiles up
        ON up.id_user = u.id_user
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
        up.first_name,
        up.last_name,
        u.email,
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
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS received_by_name,
        COALESCE(pr.supplier_name, '-') AS supplier_name
      FROM tbl_stock_in_headers h
      LEFT JOIN tbl_suppliers pr
        ON pr.id_supplier = h.id_supplier
      LEFT JOIN tbl_users u
        ON u.id_user = h.created_by
      LEFT JOIN tbl_profiles up
        ON up.id_user = u.id_user
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
  const id_user = req.user.id_user;
  const { id_supplier, notes, items } = req.body;

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

    await logActivity(client, req, {
      idUser: id_user,
      activityType: "CREATE_STOCK_IN",
      tableName: "tbl_stock_in_headers",
      recordId: stockInHeader.id_stock_in,
      description: `Created stock in ${stockInHeader.stock_in_code} with ${insertedRows.length} item row(s).`,
    });

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

module.exports = {
  getStockInDocuments,
  getStockInDocumentById,
  createStockIn,
};
