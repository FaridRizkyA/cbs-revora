// Staff grades.
const pool = require("../../config/db");
const { logActivity, logActivitySafe } = require("../../utils/activityLogger");
const { STAFF_GRADE_CODE_LOCK_KEY, normalizeText, normalizeActive, acquireAdvisoryLock, generateNextStaffGradeCode } = require("./peopleShared");

const listStaffGrades = async (req, res) => {
  const includeInactive = String(req.query.include_inactive || "").toLowerCase() === "true" || String(req.query.include_inactive || "") === "1";
  try {
    const result = await pool.query(
      `
      SELECT id_staff_grade, grade_code, grade_name, grade_order, description, is_active
      FROM tbl_staff_grades
      WHERE ($1::boolean = TRUE OR is_active = 'Y')
      ORDER BY grade_order ASC, grade_name ASC;
      `,
      [includeInactive]
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch staff grades.", error: error.message });
  }
};

const createStaffGrade = async (req, res) => {
  const gradeName = normalizeText(req.body.grade_name);
  const gradeOrder = Number(req.body.grade_order || 0);
  const description = normalizeText(req.body.description);
  const actorId = req.user.id_user;

  if (!gradeName) return res.status(400).json({ message: "grade_name is required." });
    if (!Number.isInteger(gradeOrder) || gradeOrder < 0) {
    return res.status(400).json({ message: "grade_order must be a non-negative integer." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await acquireAdvisoryLock(client, STAFF_GRADE_CODE_LOCK_KEY);
    const gradeCode = await generateNextStaffGradeCode(client);
    const result = await client.query(
      `
      INSERT INTO tbl_staff_grades (
        grade_code, grade_name, grade_order, description, created_by, last_modify_by
      ) VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING id_staff_grade, grade_code, grade_name, grade_order, description, is_active;
      `,
      [gradeCode, gradeName, gradeOrder, description, actorId]
    );
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "CREATE_STAFF_GRADE",
      tableName: "tbl_staff_grades",
      recordId: result.rows[0].id_staff_grade,
      description: `Created staff grade ${result.rows[0].grade_code}.`,
    });
    await client.query("COMMIT");
    return res.status(201).json({ message: "Staff grade created successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to create staff grade.", error: error.message });
  } finally {
    client.release();
  }
};

const updateStaffGrade = async (req, res) => {
  const gradeName = normalizeText(req.body.grade_name);
  const gradeOrder = Number(req.body.grade_order || 0);
  const description = normalizeText(req.body.description);
  const actorId = req.user.id_user;

  if (!gradeName) return res.status(400).json({ message: "grade_name is required." });
  if (!Number.isInteger(gradeOrder) || gradeOrder < 0) {
    return res.status(400).json({ message: "grade_order must be a non-negative integer." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_staff_grades
      SET grade_name = $2,
          grade_order = $3,
          description = $4,
          last_modify_date = NOW(),
          last_modify_by = $5
      WHERE id_staff_grade = $1
      RETURNING id_staff_grade, grade_code, grade_name, grade_order, description, is_active;
      `,
      [req.params.id, gradeName, gradeOrder, description, actorId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Staff grade not found." });
    await logActivitySafe(pool, req, {
      idUser: actorId,
      activityType: "UPDATE_STAFF_GRADE",
      tableName: "tbl_staff_grades",
      recordId: result.rows[0].id_staff_grade,
      description: `Updated staff grade ${result.rows[0].grade_code}.`,
    });
    return res.json({ message: "Staff grade updated successfully.", data: result.rows[0] });
  } catch (error) {
    return res.status(400).json({ message: "Failed to update staff grade.", error: error.message });
  }
};

const updateStaffGradeStatus = (req, res) =>
  updateEntityStatus(req, res, "tbl_staff_grades", "id_staff_grade", "Staff grade");

const updateEntityStatus = async (req, res, tableName, idColumn, label) => {
  const next = normalizeActive(req.body.is_active);
  if (!["Y", "N"].includes(next)) {
    return res.status(400).json({ message: "is_active must be Y or N." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE ${tableName}
      SET is_active = $2,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE ${idColumn} = $1
      RETURNING ${idColumn}, is_active;
      `,
      [req.params.id, next, req.user.id_user]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: `${label} not found.` });
    await logActivitySafe(pool, req, {
      idUser: req.user.id_user,
      activityType: next === "Y" ? `ACTIVATE_${label.toUpperCase().replace(/\s+/g, "_")}` : `DEACTIVATE_${label.toUpperCase().replace(/\s+/g, "_")}`,
      tableName,
      recordId: result.rows[0][idColumn],
      description: `${next === "Y" ? "Activated" : "Deactivated"} ${label.toLowerCase()}.`,
    });
    return res.json({ message: `${label} status updated successfully.`, data: result.rows[0] });
  } catch (error) {
    return res.status(400).json({ message: `Failed to update ${label.toLowerCase()} status.`, error: error.message });
  }
};

module.exports = {
  listStaffGrades,
  createStaffGrade,
  updateStaffGrade,
  updateStaffGradeStatus,
};
