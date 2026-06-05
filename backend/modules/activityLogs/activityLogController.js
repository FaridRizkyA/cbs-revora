const pool = require("../../config/db");
const { logActivitySafe } = require("../../utils/activityLogger");

const allowedClientActivityTypes = new Set([
  "PRINT_REPORT",
  "PRINT_RECEIPT",
  "EXPORT_REPORT",
  "SEND_REPORT_EMAIL",
]);

const resolveTargetLabel = (row) => {
  const tableName = String(row.table_name || "").trim();
  const recordId = String(row.record_id || "").trim();

  if (tableName === "tbl_users") {
    return (
      row.target_member_code ||
      row.target_staff_code ||
      row.target_user_email ||
      recordId ||
      "-"
    );
  }

  if (tableName === "tbl_members") {
    return row.target_member_code || recordId || "-";
  }

  if (tableName === "tbl_staff") {
    return row.target_staff_code || recordId || "-";
  }

  if (tableName === "tbl_suppliers") {
    return row.target_supplier_code || recordId || "-";
  }

  if (tableName === "tbl_products") {
    return row.target_product_code || recordId || "-";
  }

  if (tableName === "tbl_product_batches") {
    return row.target_batch_code || recordId || "-";
  }

  if (tableName === "tbl_stock_in_headers") {
    return row.target_stock_in_code || recordId || "-";
  }

  if (tableName === "tbl_sales") {
    return row.target_sale_number || recordId || "-";
  }

  if (tableName === "tbl_external_financial_entries") {
    return row.target_entry_source || recordId || "-";
  }

  if (tableName === "tbl_shu_periods") {
    return row.target_period_name || recordId || "-";
  }

  if (tableName === "tbl_stock_movements") {
    return (
      row.target_sale_number ||
      (String(row.target_source_type || "").trim() === "NON_SALE_OUT" ? "Stock Out Manual" : "") ||
      row.target_stock_in_code ||
      row.target_product_code ||
      recordId ||
      "-"
    );
  }

  return recordId || "-";
};

const createClientActivityLog = async (req, res) => {
  const idUser = req.body?.id_user || null;
  const activityType = String(req.body?.activity_type || "").trim().toUpperCase();
  const tableName = String(req.body?.table_name || "").trim() || null;
  const recordId = String(req.body?.record_id || "").trim() || null;
  const description = String(req.body?.description || "").trim() || null;

  if (!allowedClientActivityTypes.has(activityType)) {
    return res.status(400).json({ message: "Invalid client activity type." });
  }

  await logActivitySafe(pool, req, {
    idUser,
    activityType,
    tableName,
    recordId,
    description,
  });

  return res.status(201).json({ message: "Activity logged successfully." });
};

const listActivityLogs = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

  try {
    const result = await pool.query(
      `
      SELECT
        l.id_activity_log,
        l.id_user,
        COALESCE(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), u.email) AS actor_name,
        u.email AS actor_email,
        l.activity_type,
        l.table_name,
        l.record_id,
        tu.email AS target_user_email,
        tm_by_user.member_code AS target_member_code,
        ts_by_user.staff_code AS target_staff_code,
        tm_by_record.member_code AS target_member_code_record,
        ts_by_record.staff_code AS target_staff_code_record,
        sup.supplier_code AS target_supplier_code,
        prod.product_code AS target_product_code,
        pb.batch_code AS target_batch_code,
        sih.stock_in_code AS target_stock_in_code,
        sale.sale_number AS target_sale_number,
        efe.entry_source AS target_entry_source,
        shup.period_name AS target_period_name,
        tsm.source_type AS target_source_type,
        l.description,
        l.ip_address,
        l.user_agent,
        l.activity_date,
        l.created_date
      FROM tbl_activity_logs l
      LEFT JOIN tbl_users u ON u.id_user = l.id_user
      LEFT JOIN tbl_profiles p ON p.id_user = u.id_user
      LEFT JOIN tbl_users tu ON tu.id_user = l.record_id
      LEFT JOIN tbl_members tm_by_user ON tm_by_user.id_user = tu.id_user
      LEFT JOIN tbl_staff ts_by_user ON ts_by_user.id_user = tu.id_user
      LEFT JOIN tbl_members tm_by_record ON tm_by_record.id_member = l.record_id
      LEFT JOIN tbl_staff ts_by_record ON ts_by_record.id_staff = l.record_id
      LEFT JOIN tbl_suppliers sup ON sup.id_supplier = l.record_id
      LEFT JOIN tbl_products prod ON prod.id_product = l.record_id
      LEFT JOIN tbl_product_batches pb ON pb.id_product_batch = l.record_id
      LEFT JOIN tbl_stock_in_headers sih ON sih.id_stock_in = l.record_id
      LEFT JOIN tbl_sales sale ON sale.id_sale = l.record_id
      LEFT JOIN tbl_external_financial_entries efe ON efe.id_external_entry = l.record_id
      LEFT JOIN tbl_shu_periods shup ON shup.id_shu_period = l.record_id
      LEFT JOIN LATERAL (
        SELECT sm.source_type
        FROM tbl_stock_movements sm
        WHERE sm.source_id = l.record_id
        ORDER BY sm.created_date DESC, sm.id_stock_movement DESC
        LIMIT 1
      ) tsm ON TRUE
      WHERE l.is_active = 'Y'
      ORDER BY l.activity_date DESC, l.created_date DESC
      LIMIT $1;
      `,
      [limit]
    );
    return res.json({
      data: result.rows.map((row) => ({
        ...row,
        target_label: resolveTargetLabel({
          ...row,
          target_member_code: row.target_member_code || row.target_member_code_record || null,
          target_staff_code: row.target_staff_code || row.target_staff_code_record || null,
        }),
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch activity logs.", error: error.message });
  }
};

module.exports = {
  createClientActivityLog,
  listActivityLogs,
};
