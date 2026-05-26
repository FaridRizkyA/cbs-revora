const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "../../backend/.env") });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      WITH candidates AS (
        SELECT
          sm.id_stock_movement,
          sm.id_product,
          sm.id_product_batch,
          sm.quantity,
          sm.created_by,
          sm.movement_date,
          p.id_supplier,
          pb.expired_date
        FROM tbl_stock_movements sm
        JOIN tbl_products p
          ON p.id_product = sm.id_product
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        WHERE sm.movement_type = 'IN'
          AND sm.is_active = 'Y'
          AND (sm.source_type IS NULL OR sm.source_type = '')
          AND sm.id_product_batch IS NOT NULL
      ),
      inserted_headers AS (
        INSERT INTO tbl_stock_in_headers (
          id_stock_in,
          stock_in_code,
          id_supplier,
          stock_in_date,
          notes,
          created_by
        )
        SELECT
          gen_random_uuid(),
          'STI/BACKFILL/' || REPLACE(c.id_stock_movement::text, '-', ''),
          c.id_supplier,
          c.movement_date,
          'Backfilled from legacy stock movements',
          c.created_by
        FROM candidates c
        RETURNING id_stock_in, stock_in_code
      ),
      mapped AS (
        SELECT
          c.*,
          h.id_stock_in
        FROM candidates c
        JOIN tbl_stock_in_headers h
          ON h.stock_in_code = 'STI/BACKFILL/' || REPLACE(c.id_stock_movement::text, '-', '')
      ),
      inserted_items AS (
        INSERT INTO tbl_stock_in_items (
          id_stock_in_item,
          id_stock_in,
          id_product,
          id_product_batch,
          quantity,
          expired_date,
          created_by
        )
        SELECT
          gen_random_uuid(),
          m.id_stock_in,
          m.id_product,
          m.id_product_batch,
          m.quantity,
          COALESCE(m.expired_date, CURRENT_DATE),
          m.created_by
        FROM mapped m
        RETURNING id_stock_in_item, id_stock_in, id_product, id_product_batch, quantity
      )
      UPDATE tbl_stock_movements sm
      SET
        source_type = 'STOCK_IN',
        source_id = h.id_stock_in,
        source_item_id = i.id_stock_in_item
      FROM candidates c
      JOIN tbl_stock_in_headers h
        ON h.stock_in_code = 'STI/BACKFILL/' || REPLACE(c.id_stock_movement::text, '-', '')
      JOIN tbl_stock_in_items i
        ON i.id_stock_in = h.id_stock_in
       AND i.id_product = c.id_product
       AND i.id_product_batch = c.id_product_batch
       AND i.quantity = c.quantity
      WHERE sm.id_stock_movement = c.id_stock_movement
        AND (sm.source_type IS NULL OR sm.source_type = '');
    `);

    await client.query("COMMIT");
    console.log("Backfill completed.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Backfill failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();


