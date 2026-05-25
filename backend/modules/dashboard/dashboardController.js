const pool = require("../../config/db");

const summaryCard = async (req, res) => {
  try {
    const [salesSummary, expiredSummary] = await Promise.all([
      pool.query(
        `
        SELECT
          COALESCE(SUM(total_amount), 0)::float AS total_sales,
          COUNT(*)::int AS total_transactions,
          COUNT(*) FILTER (WHERE sale_date::date = CURRENT_DATE)::int AS today_transactions
        FROM tbl_sales
        WHERE is_active = 'Y';
        `
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE expired_date < CURRENT_DATE)::int AS expired_batch_count,
          COUNT(*) FILTER (
            WHERE expired_date >= CURRENT_DATE
              AND expired_date <= CURRENT_DATE + INTERVAL '14 days'
          )::int AS near_expired_batch_count
        FROM tbl_product_batches
        WHERE is_active = 'Y';
        `
      ),
    ]);

    res.json({
      data: {
        total_sales: salesSummary.rows[0].total_sales,
        total_transactions: salesSummary.rows[0].total_transactions,
        today_transactions: salesSummary.rows[0].today_transactions,
        expired_batch_count: expiredSummary.rows[0].expired_batch_count,
        near_expired_batch_count: expiredSummary.rows[0].near_expired_batch_count,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch summary cards.",
      error: error.message,
    });
  }
};

const graphs = async (req, res) => {
  try {
    const [lineGraphResult, pieGraphResult, barGraphResult, donutGraphResult] = await Promise.all([
      pool.query(
        `
        WITH month_series AS (
          SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * gs.n) AS month_start
          FROM generate_series(5, 0, -1) AS gs(n)
        )
        SELECT
          TO_CHAR(ms.month_start, 'YYYY-MM') AS month_key,
          TO_CHAR(ms.month_start, 'Mon') AS month_label,
          COALESCE(SUM(s.total_amount), 0)::float AS total_profit,
          COUNT(s.id_sale)::int AS total_transactions
        FROM month_series ms
        LEFT JOIN tbl_sales s
          ON date_trunc('month', s.sale_date) = ms.month_start
          AND s.is_active = 'Y'
        GROUP BY ms.month_start
        ORDER BY ms.month_start;
        `
      ),
      pool.query(
        `
        WITH stock_per_product AS (
          SELECT
            p.id_product,
            p.product_name,
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
            )::int AS available_stock
          FROM tbl_products p
          LEFT JOIN tbl_stock_movements sm
            ON sm.id_product = p.id_product
            AND sm.is_active = 'Y'
          WHERE p.is_active = 'Y'
          GROUP BY p.id_product, p.product_name
        ),
        total_stock AS (
          SELECT COALESCE(SUM(available_stock), 0)::float AS all_stock
          FROM stock_per_product
        )
        SELECT
          spp.id_product,
          spp.product_name,
          spp.available_stock,
          CASE
            WHEN ts.all_stock = 0 THEN 0
            ELSE ROUND((spp.available_stock::numeric / ts.all_stock::numeric) * 100, 2)
          END::float AS percentage
        FROM stock_per_product spp
        CROSS JOIN total_stock ts
        ORDER BY spp.available_stock DESC, spp.product_name ASC;
        `
      ),
      pool.query(
        `
        SELECT
          p.id_product,
          p.product_name,
          COUNT(DISTINCT si.id_sale)::int AS transaction_count,
          COALESCE(SUM(si.quantity), 0)::int AS total_quantity
        FROM tbl_sale_items si
        JOIN tbl_sales s
          ON s.id_sale = si.id_sale
          AND s.is_active = 'Y'
        JOIN tbl_products p
          ON p.id_product = si.id_product
          AND p.is_active = 'Y'
        WHERE si.is_active = 'Y'
        GROUP BY p.id_product, p.product_name
        ORDER BY transaction_count DESC, total_quantity DESC, p.product_name ASC
        LIMIT 3;
        `
      ),
      pool.query(
        `
        WITH stock_per_product AS (
          SELECT
            p.id_product,
            p.minimum_stock,
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
            )::int AS available_stock
          FROM tbl_products p
          LEFT JOIN tbl_stock_movements sm
            ON sm.id_product = p.id_product
            AND sm.is_active = 'Y'
          WHERE p.is_active = 'Y'
          GROUP BY p.id_product, p.minimum_stock
        )
        SELECT
          COUNT(*) FILTER (WHERE available_stock <= 0)::int AS out_of_stock,
          COUNT(*) FILTER (
            WHERE available_stock > 0
              AND available_stock <= minimum_stock
          )::int AS low_stock,
          COUNT(*) FILTER (WHERE available_stock > minimum_stock)::int AS safe_stock
        FROM stock_per_product;
        `
      ),
    ]);

    res.json({
      data: {
        line_graph: lineGraphResult.rows,
        pie_graph: pieGraphResult.rows,
        bar_graph: barGraphResult.rows,
        donut_graph: donutGraphResult.rows[0],
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch dashboard graphs.",
      error: error.message,
    });
  }
};

const recentTransaction = async (req, res) => {
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 10));

  try {
    const result = await pool.query(
      `
      SELECT
        s.id_sale,
        s.sale_number,
        s.sale_date,
        COALESCE(m.full_name, 'General') AS member_name,
        COALESCE(items.item_count, 0)::int AS item_count,
        s.total_amount::float AS total_amount,
        LOWER(s.payment_method) AS payment_method
      FROM tbl_sales s
      LEFT JOIN tbl_members m
        ON m.id_member = s.id_member
      LEFT JOIN (
        SELECT
          si.id_sale,
          SUM(si.quantity)::int AS item_count
        FROM tbl_sale_items si
        WHERE si.is_active = 'Y'
        GROUP BY si.id_sale
      ) items
        ON items.id_sale = s.id_sale
      WHERE s.is_active = 'Y'
      ORDER BY s.sale_date DESC
      LIMIT $1;
      `,
      [limit]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch recent transactions.",
      error: error.message,
    });
  }
};

module.exports = {
  summaryCard,
  graphs,
  recentTransaction,
};
