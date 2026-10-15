// Sales Items and Sales Cost ledgers.
const pool = require("../../config/db");

const getSalesItems = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        si.id_sale_item,
        s.id_sale,
        s.sale_number AS sale_code,
        s.sale_number AS stock_out_code,
        s.sale_date,
        s.payment_method,
        s.customer_type,
        p.id_product,
        p.product_code,
        p.product_name,
        pb.batch_code,
        si.quantity,
        si.unit_price::float AS sell_per_pcs,
        si.subtotal::float AS total_sell,
        pb.purchase_price::float AS buy_per_pcs,
        (COALESCE(pb.purchase_price, 0) * si.quantity)::float AS total_buy,
        ((COALESCE(si.unit_price, 0) - COALESCE(pb.purchase_price, 0)) * si.quantity)::float AS profit,
        s.id_cashier,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS cashier_name
      FROM tbl_sale_items si
      JOIN tbl_sales s
        ON s.id_sale = si.id_sale
       AND s.is_active = 'Y'
      JOIN tbl_products p
        ON p.id_product = si.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = si.id_product_batch
      LEFT JOIN tbl_users u
        ON u.id_user = s.id_cashier
      LEFT JOIN tbl_profiles up
        ON up.id_user = u.id_user
      WHERE si.is_active = 'Y'
        AND (
          $1 = ''
          OR s.sale_number ILIKE $2
          OR p.product_code ILIKE $2
          OR p.product_name ILIKE $2
          OR COALESCE(pb.batch_code, '') ILIKE $2
          OR COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '') ILIKE $2
        )
      ORDER BY s.sale_date DESC, s.sale_number DESC, p.product_name ASC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sales items.",
      error: error.message,
    });
  }
};

const getSalesCosts = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        i.id_stock_in_item,
        h.id_stock_in,
        h.stock_in_code,
        h.stock_in_date,
        h.notes,
        p.id_product,
        p.product_code,
        p.product_name,
        pb.id_product_batch,
        pb.batch_code,
        COALESCE(s.supplier_name, '-') AS supplier_name,
        i.quantity,
        pb.purchase_price::float AS buy_per_pcs,
        (COALESCE(pb.purchase_price, 0) * i.quantity)::float AS total_cost,
        i.expired_date,
        h.created_by AS received_by_id,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS received_by_name
      FROM tbl_stock_in_items i
      JOIN tbl_stock_in_headers h
        ON h.id_stock_in = i.id_stock_in
      JOIN tbl_products p
        ON p.id_product = i.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = i.id_product_batch
      LEFT JOIN tbl_suppliers s
        ON s.id_supplier = h.id_supplier
      LEFT JOIN tbl_users u
        ON u.id_user = h.created_by
      LEFT JOIN tbl_profiles up
        ON up.id_user = u.id_user
      WHERE (
          $1 = ''
          OR h.stock_in_code ILIKE $2
          OR p.product_code ILIKE $2
          OR p.product_name ILIKE $2
          OR COALESCE(pb.batch_code, '') ILIKE $2
          OR COALESCE(s.supplier_name, '') ILIKE $2
          OR COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '') ILIKE $2
        )
      ORDER BY h.stock_in_date DESC, h.stock_in_code DESC, p.product_name ASC;
      `,
      [search, `%${search}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sales costs.",
      error: error.message,
    });
  }
};

module.exports = {
  getSalesItems,
  getSalesCosts,
};
