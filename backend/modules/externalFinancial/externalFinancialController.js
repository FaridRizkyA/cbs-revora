const pool = require("../../config/db");
const { logActivitySafe } = require("../../utils/activityLogger");

const listExternalFinancialEntries = async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id_external_entry,
        entry_type,
        entry_date,
        entry_source,
        amount::float AS amount,
        notes,
        is_active,
        created_date,
        last_modify_date
      FROM tbl_external_financial_entries
      ORDER BY entry_date DESC, created_date DESC;
      `
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch external financial entries.", error: error.message });
  }
};

const createExternalFinancialEntry = async (req, res) => {
  const { entry_type, entry_date, entry_source, amount, notes, id_user } = req.body || {};
  const normalizedType = String(entry_type || "").toUpperCase();
  const normalizedAmount = Number(amount || 0);

  if (!["INCOME", "OUTCOME"].includes(normalizedType)) {
    return res.status(400).json({ message: "Entry type must be INCOME or OUTCOME." });
  }
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry_date))) {
    return res.status(400).json({ message: "Entry date must use YYYY-MM-DD format." });
  }
  if (!String(entry_source || "").trim()) {
    return res.status(400).json({ message: "Entry source is required." });
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0." });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO tbl_external_financial_entries (
        entry_type, entry_date, entry_source, amount, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [normalizedType, entry_date, String(entry_source).trim(), normalizedAmount, notes?.trim() || null, id_user || null]
    );
    await logActivitySafe(pool, req, {
      idUser: id_user || null,
      activityType: "CREATE_EXTERNAL_FINANCIAL",
      tableName: "tbl_external_financial_entries",
      recordId: result.rows[0].id_external_entry,
      description: `Created ${normalizedType} external financial entry for ${normalizedAmount}.`,
    });
    return res.status(201).json({ message: "External financial entry created successfully.", data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create external financial entry.", error: error.message });
  }
};

const updateExternalFinancialEntry = async (req, res) => {
  const { id } = req.params;
  const { entry_type, entry_date, entry_source, amount, notes, is_active, id_user } = req.body || {};
  const normalizedType = String(entry_type || "").toUpperCase();
  const normalizedAmount = Number(amount || 0);
  const normalizedActive = String(is_active || "Y").toUpperCase();

  if (!["INCOME", "OUTCOME"].includes(normalizedType)) {
    return res.status(400).json({ message: "Entry type must be INCOME or OUTCOME." });
  }
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry_date))) {
    return res.status(400).json({ message: "Entry date must use YYYY-MM-DD format." });
  }
  if (!String(entry_source || "").trim()) {
    return res.status(400).json({ message: "Entry source is required." });
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0." });
  }
  if (!["Y", "N"].includes(normalizedActive)) {
    return res.status(400).json({ message: "Active status must be Y or N." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_external_financial_entries
      SET entry_type = $2,
          entry_date = $3,
          entry_source = $4,
          amount = $5,
          notes = $6,
          is_active = $7,
          last_modify_date = NOW(),
          last_modify_by = $8
      WHERE id_external_entry = $1
      RETURNING *;
      `,
      [id, normalizedType, entry_date, String(entry_source).trim(), normalizedAmount, notes?.trim() || null, normalizedActive, id_user || null]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "External financial entry not found." });
    await logActivitySafe(pool, req, {
      idUser: id_user || null,
      activityType: "UPDATE_EXTERNAL_FINANCIAL",
      tableName: "tbl_external_financial_entries",
      recordId: result.rows[0].id_external_entry,
      description: `Updated ${normalizedType} external financial entry for ${normalizedAmount}.`,
    });
    return res.json({ message: "External financial entry updated successfully.", data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update external financial entry.", error: error.message });
  }
};

const updateExternalFinancialEntryStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active, id_user } = req.body || {};
  const normalizedActive = String(is_active || "").toUpperCase();
  if (!["Y", "N"].includes(normalizedActive)) {
    return res.status(400).json({ message: "Active status must be Y or N." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_external_financial_entries
      SET is_active = $2,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE id_external_entry = $1
      RETURNING *;
      `,
      [id, normalizedActive, id_user || null]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "External financial entry not found." });
    await logActivitySafe(pool, req, {
      idUser: id_user || null,
      activityType: normalizedActive === "Y" ? "ACTIVATE_EXTERNAL_FINANCIAL" : "DEACTIVATE_EXTERNAL_FINANCIAL",
      tableName: "tbl_external_financial_entries",
      recordId: result.rows[0].id_external_entry,
      description: `${normalizedActive === "Y" ? "Activated" : "Deactivated"} external financial entry.`,
    });
    return res.json({ message: "External financial entry status updated successfully.", data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update external financial entry status.", error: error.message });
  }
};

module.exports = {
  listExternalFinancialEntries,
  createExternalFinancialEntry,
  updateExternalFinancialEntry,
  updateExternalFinancialEntryStatus,
};
