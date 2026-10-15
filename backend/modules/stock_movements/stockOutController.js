// Stock out documents: sales stock out and manual (non-sale) stock out.
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { SIGNED_QUANTITY_SQL } = require("../../utils/stockSql");

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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS cashier_name,
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
        LEFT JOIN tbl_profiles up
          ON up.id_user = u.id_user
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
        GROUP BY s.id_sale, s.sale_date, s.notes, s.id_cashier, up.first_name, up.last_name, u.email
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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS cashier_name,
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
        LEFT JOIN tbl_profiles up
          ON up.id_user = u.id_user
        LEFT JOIN tbl_stock_movements sm
          ON sm.source_type = 'SALE'
         AND sm.source_id = s.id_sale
         AND sm.movement_type = 'OUT'
         AND sm.is_active = 'Y'
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        LEFT JOIN tbl_sale_items si
          ON si.id_sale_item = sm.source_item_id
        GROUP BY s.id_sale, s.sale_date, s.notes, s.id_cashier, up.first_name, up.last_name, u.email
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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS operator_name,
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
        LEFT JOIN tbl_profiles up
          ON up.id_user = u.id_user
        WHERE sm.is_active = 'Y'
          AND sm.source_type = 'NON_SALE_OUT'
          AND sm.movement_type = 'OUT'
        GROUP BY sm.source_id, up.first_name, up.last_name, u.email
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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS operator_name,
          TO_CHAR(MIN(sm.movement_date), 'YYYYMMDD') AS date_token,
          UPPER(LEFT(REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', ''), 1)) AS type_token
        FROM tbl_stock_movements sm
        LEFT JOIN tbl_users u
          ON u.id_user = sm.created_by
        LEFT JOIN tbl_profiles up
          ON up.id_user = u.id_user
        WHERE sm.source_type = 'NON_SALE_OUT'
          AND sm.movement_type = 'OUT'
          AND sm.is_active = 'Y'
        GROUP BY sm.source_id, up.first_name, up.last_name, u.email
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
  const id_user = req.user.id_user;
  const { reason, notes, items, return_refund } = req.body || {};
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

    const sourceId = (await client.query(`SELECT gen_random_uuid()::text AS source_id;`)).rows[0].source_id;
    const insertedItems = [];

    for (const item of items) {
      const idProduct = String(item.id_product);
      const requestedQuantity = Number(item.quantity);
      const selectedBatchId = String(item.id_product_batch || "").trim();

      // Lock the product row like checkout does, so concurrent stock reductions run one at a time.
      await client.query(`SELECT 1 FROM tbl_products WHERE id_product = $1 FOR UPDATE;`, [idProduct]);

      const productResult = await client.query(
        `
        SELECT
          p.id_product,
          p.product_code,
          p.product_name,
          GREATEST(
            COALESCE(
              SUM(${SIGNED_QUANTITY_SQL}),
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
                SUM(${SIGNED_QUANTITY_SQL}),
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
                SUM(${SIGNED_QUANTITY_SQL}),
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
            COALESCE(SUM(${SIGNED_QUANTITY_SQL}), 0),
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

    await logActivity(client, req, {
      idUser: id_user,
      activityType: "CREATE_STOCK_OUT",
      tableName: "tbl_stock_movements",
      recordId: sourceId,
      description: `Created non-sales stock out ${finalizedReason} with ${insertedItems.length} item row(s).`,
    });

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

module.exports = {
  getStockOutDocuments,
  getStockOutDocumentById,
  getStockOutManualDocuments,
  getStockOutManualDocumentById,
  createStockOutManual,
};
