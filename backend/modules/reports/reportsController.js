const pool = require("../../config/db");

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const dataSources = {
  users: {
    label: "Users",
    dateColumn: "u.created_date",
    orderBy: "u.created_date DESC",
    columns: [
      { key: "email", title: "Email", align: "left" },
      { key: "full_name", title: "Full Name", align: "left" },
      { key: "roles", title: "Roles", align: "left" },
      { key: "status", title: "Status", align: "center" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        u.id_user::text AS id,
        u.email,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        COALESCE(STRING_AGG(DISTINCT r.role_name, ', '), '-') AS roles,
        CASE WHEN u.is_active = 'Y' THEN 'Active' ELSE 'Inactive' END AS status,
        u.created_date
      FROM tbl_users u
      LEFT JOIN tbl_profiles p ON p.id_user = u.id_user
      LEFT JOIN tbl_user_roles ur ON ur.id_user = u.id_user AND ur.is_active = 'Y'
      LEFT JOIN tbl_roles r ON r.id_role = ur.id_role
      WHERE ($1::date IS NULL OR u.created_date::date >= $1::date)
        AND ($2::date IS NULL OR u.created_date::date <= $2::date)
      GROUP BY u.id_user, u.email, p.first_name, p.last_name, u.is_active, u.created_date
    `,
  },
  members: {
    label: "Members",
    dateColumn: "m.created_date",
    orderBy: "m.member_code ASC",
    columns: [
      { key: "member_code", title: "Member Code", align: "left" },
      { key: "full_name", title: "Full Name", align: "left" },
      { key: "email", title: "Email", align: "left" },
      { key: "phone_number", title: "Phone", align: "left" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        m.id_member::text AS id,
        m.member_code,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        u.email,
        p.phone_number,
        m.created_date
      FROM tbl_members m
      LEFT JOIN tbl_profiles p ON p.id_user = m.id_user
      LEFT JOIN tbl_users u ON u.id_user = m.id_user
      WHERE m.is_active = 'Y'
        AND ($1::date IS NULL OR m.created_date::date >= $1::date)
        AND ($2::date IS NULL OR m.created_date::date <= $2::date)
    `,
  },
  staffs: {
    label: "Staffs",
    dateColumn: "s.created_date",
    orderBy: "s.staff_code ASC",
    columns: [
      { key: "staff_code", title: "Staff Code", align: "left" },
      { key: "full_name", title: "Full Name", align: "left" },
      { key: "email", title: "Email", align: "left" },
      { key: "grade_name", title: "Grade", align: "left" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        s.id_staff::text AS id,
        s.staff_code,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        u.email,
        g.grade_name,
        s.created_date
      FROM tbl_staff s
      LEFT JOIN tbl_profiles p ON p.id_user = s.id_user
      LEFT JOIN tbl_users u ON u.id_user = s.id_user
      LEFT JOIN tbl_staff_grades g ON g.id_staff_grade = s.id_staff_grade
      WHERE s.is_active = 'Y'
        AND ($1::date IS NULL OR s.created_date::date >= $1::date)
        AND ($2::date IS NULL OR s.created_date::date <= $2::date)
    `,
  },
  suppliers: {
    label: "Suppliers",
    dateColumn: "pr.created_date",
    orderBy: "pr.supplier_code ASC",
    columns: [
      { key: "supplier_code", title: "Supplier Code", align: "left" },
      { key: "supplier_name", title: "Supplier", align: "left" },
      { key: "city", title: "City", align: "left" },
      { key: "phone_number", title: "Phone", align: "left" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        pr.id_supplier::text AS id,
        pr.supplier_code,
        pr.supplier_name,
        pr.city,
        pr.phone_number,
        pr.created_date
      FROM tbl_suppliers pr
      WHERE pr.is_active = 'Y'
        AND ($1::date IS NULL OR pr.created_date::date >= $1::date)
        AND ($2::date IS NULL OR pr.created_date::date <= $2::date)
    `,
  },
  products: {
    label: "Products",
    dateColumn: "p.created_date",
    orderBy: "p.product_name ASC",
    columns: [
      { key: "product_code", title: "Product Code", align: "left" },
      { key: "product_name", title: "Product", align: "left" },
      { key: "supplier_name", title: "Supplier", align: "left" },
      { key: "selling_price", title: "Selling Price", align: "right" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        p.id_product::text AS id,
        p.product_code,
        p.product_name,
        COALESCE(pr.supplier_name, '-') AS supplier_name,
        p.selling_price::float AS selling_price,
        p.created_date
      FROM tbl_products p
      LEFT JOIN tbl_suppliers pr ON pr.id_supplier = p.id_supplier
      WHERE p.is_active = 'Y'
        AND ($1::date IS NULL OR p.created_date::date >= $1::date)
        AND ($2::date IS NULL OR p.created_date::date <= $2::date)
    `,
  },
  batches: {
    label: "Product Batches",
    dateColumn: "pb.created_date",
    orderBy: "pb.created_date DESC",
    columns: [
      { key: "batch_code", title: "Batch Code", align: "left" },
      { key: "product_name", title: "Product", align: "left" },
      { key: "purchase_price", title: "Buy /pcs", align: "right" },
      { key: "expired_date", title: "Expired Date", align: "left" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        pb.id_product_batch::text AS id,
        pb.batch_code,
        p.product_name,
        pb.purchase_price::float AS purchase_price,
        pb.expired_date,
        pb.created_date
      FROM tbl_product_batches pb
      JOIN tbl_products p ON p.id_product = pb.id_product
      WHERE ($1::date IS NULL OR pb.created_date::date >= $1::date)
        AND ($2::date IS NULL OR pb.created_date::date <= $2::date)
    `,
  },
  stock_in: {
    label: "Stock In",
    dateColumn: "h.created_date",
    orderBy: "h.created_date DESC",
    columns: [
      { key: "stock_in_code", title: "Stock In Code", align: "left" },
      { key: "supplier_name", title: "Supplier", align: "left" },
      { key: "stock_in_date", title: "Date In", align: "left" },
      { key: "total_qty", title: "Total Qty", align: "right" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        h.id_stock_in::text AS id,
        h.stock_in_code,
        COALESCE(s.supplier_name, '-') AS supplier_name,
        h.stock_in_date,
        COALESCE(SUM(i.quantity), 0)::int AS total_qty,
        h.created_date
      FROM tbl_stock_in_headers h
      LEFT JOIN tbl_suppliers s ON s.id_supplier = h.id_supplier
      LEFT JOIN tbl_stock_in_items i ON i.id_stock_in = h.id_stock_in
      WHERE ($1::date IS NULL OR h.created_date::date >= $1::date)
        AND ($2::date IS NULL OR h.created_date::date <= $2::date)
      GROUP BY h.id_stock_in, h.stock_in_code, s.supplier_name, h.stock_in_date, h.created_date
    `,
  },
  stock_out: {
    label: "Stock Out",
    dateColumn: "sm.created_date",
    orderBy: "MAX(sm.created_date) DESC",
    columns: [
      { key: "stock_out_code", title: "Stock Out Code", align: "left" },
      { key: "stock_out_type", title: "Type", align: "left" },
      { key: "movement_date", title: "Date", align: "left" },
      { key: "total_qty", title: "Total Qty", align: "right" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        COALESCE(sm.source_id::text, sm.id_stock_movement::text) AS id,
        COALESCE(
          'STO/' || TO_CHAR(MAX(s.sale_date), 'YYYYMMDD') || '/SALE/' || UPPER(LEFT(MAX(s.id_sale::text), 6)),
          MAX(sm.source_id::text),
          MAX(sm.id_stock_movement::text)
        ) AS stock_out_code,
        CASE WHEN sm.source_type = 'SALE' THEN 'SALE' ELSE REPLACE(MAX(sm.reason), 'NON_SALE_OUT:', '') END AS stock_out_type,
        MIN(sm.movement_date) AS movement_date,
        COALESCE(SUM(sm.quantity), 0)::int AS total_qty,
        MAX(sm.created_date) AS created_date
      FROM tbl_stock_movements sm
      LEFT JOIN tbl_sales s ON s.id_sale = sm.source_id AND sm.source_type = 'SALE'
      WHERE sm.movement_type = 'OUT'
        AND sm.source_type IN ('SALE', 'NON_SALE_OUT')
        AND sm.is_active = 'Y'
        AND ($1::date IS NULL OR sm.created_date::date >= $1::date)
        AND ($2::date IS NULL OR sm.created_date::date <= $2::date)
      GROUP BY COALESCE(sm.source_id::text, sm.id_stock_movement::text), sm.source_type
    `,
  },
  stock_adjustment: {
    label: "Stock Adjustment",
    dateColumn: "sm.created_date",
    orderBy: "sm.created_date DESC",
    columns: [
      { key: "product_name", title: "Product", align: "left" },
      { key: "batch_code", title: "Batch", align: "left" },
      { key: "type", title: "Type", align: "left" },
      { key: "quantity", title: "Qty", align: "right" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        sm.id_stock_movement::text AS id,
        p.product_name,
        pb.batch_code,
        CASE WHEN sm.movement_type = 'IN' THEN 'INCREASE' ELSE 'DECREASE' END AS type,
        sm.quantity,
        sm.created_date
      FROM tbl_stock_movements sm
      JOIN tbl_products p ON p.id_product = sm.id_product
      LEFT JOIN tbl_product_batches pb ON pb.id_product_batch = sm.id_product_batch
      WHERE sm.is_active = 'Y'
        AND (
          sm.reason LIKE 'ADJUSTMENT_INCREASE:%'
          OR sm.reason LIKE 'ADJUSTMENT_DECREASE:%'
          OR sm.reason LIKE 'ADJUSTMENT:%'
        )
        AND ($1::date IS NULL OR sm.created_date::date >= $1::date)
        AND ($2::date IS NULL OR sm.created_date::date <= $2::date)
    `,
  },
  external_financial: {
    label: "External Financials",
    dateColumn: "e.created_date",
    orderBy: "e.created_date DESC",
    columns: [
      { key: "entry_type", title: "Type", align: "left" },
      { key: "entry_date", title: "Entry Date", align: "left" },
      { key: "entry_source", title: "Source", align: "left" },
      { key: "amount", title: "Amount", align: "right" },
      { key: "created_date", title: "Created Date", align: "left" },
    ],
    sql: `
      SELECT
        e.id_external_entry::text AS id,
        e.entry_type,
        e.entry_date,
        e.entry_source,
        e.amount::float AS amount,
        e.created_date
      FROM tbl_external_financial_entries e
      WHERE e.is_active = 'Y'
        AND ($1::date IS NULL OR e.created_date::date >= $1::date)
        AND ($2::date IS NULL OR e.created_date::date <= $2::date)
    `,
  },
};

const listReportDataSources = (_req, res) => {
  res.json({
    data: Object.entries(dataSources).map(([key, source]) => ({
      key,
      label: source.label,
      columns: source.columns,
    })),
  });
};

const parseReportDate = (value, fallback) => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!dateOnlyPattern.test(text)) return false;
  return text;
};

const runReport = async (req, res) => {
  const sourceKey = String(req.query.source || req.body?.source || "").trim();
  const source = dataSources[sourceKey];

  if (!source) {
    return res.status(400).json({ message: "Invalid report data source." });
  }

  const startDate = parseReportDate(req.query.start_date || req.body?.start_date);
  const endDate = parseReportDate(req.query.end_date || req.body?.end_date);

  if (startDate === false || endDate === false) {
    return res.status(400).json({ message: "start_date and end_date must use YYYY-MM-DD format." });
  }

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ message: "start_date cannot be later than end_date." });
  }

  try {
    const result = await pool.query(`${source.sql} ORDER BY ${source.orderBy};`, [startDate, endDate]);
    return res.json({
      data: {
        source: {
          key: sourceKey,
          label: source.label,
        },
        columns: source.columns,
        rows: result.rows,
        filters: {
          created_date_from: startDate,
          created_date_to: endDate,
        },
        total_rows: result.rows.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report.", error: error.message });
  }
};

module.exports = {
  listReportDataSources,
  runReport,
};
