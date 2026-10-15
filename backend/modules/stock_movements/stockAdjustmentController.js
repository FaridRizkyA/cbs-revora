// Stock adjustments (stock opname corrections).
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { SIGNED_QUANTITY_SQL } = require("../../utils/stockSql");

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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS operator_name,
          TO_CHAR(sm.movement_date, 'YYYYMMDD') AS date_token,
          CASE WHEN sm.movement_type = 'IN' THEN 'I' ELSE 'D' END AS type_token
        FROM tbl_stock_movements sm
        JOIN tbl_products p
          ON p.id_product = sm.id_product
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        LEFT JOIN tbl_users u
          ON u.id_user = sm.created_by
        LEFT JOIN tbl_profiles up
          ON up.id_user = u.id_user
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
  const id_user = req.user.id_user;
  const {
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

    const productResult = await client.query(
      `
      SELECT
        p.id_product,
        p.product_code,
        p.product_name
      FROM tbl_products p
      WHERE p.id_product = $1
        AND p.is_active = 'Y'
      LIMIT 1
      FOR UPDATE;
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
              ${SIGNED_QUANTITY_SQL}
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

    await logActivity(client, req, {
      idUser: id_user,
      activityType: "CREATE_STOCK_ADJUSTMENT",
      tableName: "tbl_stock_movements",
      recordId: insertResult.rows[0].id_stock_movement,
      description: `Created ${normalizedType} stock adjustment for ${product.product_name}, quantity ${qty}.`,
    });

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

module.exports = {
  getStockAdjustments,
  createStockAdjustment,
};
