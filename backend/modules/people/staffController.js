// Staff and their officer roles.
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { toLocalIsoDate } = require("../../utils/dateUtils");
const { STAFF_CODE_LOCK_KEY, normalizeActive, toDateOrNull, fullNameSql, acquireAdvisoryLock, generateNextStaffCode, syncStaffOfficerRole, ensureProfile, assignRoleByName, deactivateRoleByNames } = require("./peopleShared");

const listStaffs = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id_staff,
        s.id_user,
        p.id_profile,
        s.id_staff_grade,
        s.staff_code,
        s.join_date,
        s.exit_date,
        s.is_active,
        s.created_date AS created_at,
        u.email,
        p.first_name,
        p.last_name,
        ${fullNameSql} AS full_name,
        p.phone_number,
        p.address,
        p.profile_image,
        g.grade_code,
        g.grade_name,
        (
          SELECT r.role_name
          FROM tbl_user_roles ur
          JOIN tbl_roles r ON r.id_role = ur.id_role
          WHERE ur.id_user = s.id_user
            AND ur.is_active = 'Y'
            AND r.role_name IN ('ADMIN', 'STAFF', 'CASHIER')
          ORDER BY
            CASE r.role_name
              WHEN 'ADMIN' THEN 1
              WHEN 'STAFF' THEN 2
              WHEN 'CASHIER' THEN 3
              ELSE 99
            END ASC
          LIMIT 1
        ) AS access_role
      FROM tbl_staff s
      LEFT JOIN tbl_users u
        ON u.id_user = s.id_user
      LEFT JOIN tbl_profiles p
        ON p.id_user = s.id_user
      LEFT JOIN tbl_staff_grades g
        ON g.id_staff_grade = s.id_staff_grade
      ORDER BY s.staff_code ASC, s.created_date DESC;
      `
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch staffs.", error: error.message });
  }
};

const createStaff = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUser = req.body.id_user;
    const actorId = req.user.id_user;
    const accessRole = String(req.body.access_role || "").trim().toUpperCase();
    const joinDate = toDateOrNull(req.body.join_date) || toLocalIsoDate();
    if (!idUser) throw new Error("id_user is required.");
    if (!["ADMIN", "STAFF", "CASHIER"].includes(accessRole)) throw new Error("access_role must be ADMIN, STAFF, or CASHIER.");

    await client.query("BEGIN");
    await ensureProfile(client, req.body, idUser, actorId);
    await acquireAdvisoryLock(client, STAFF_CODE_LOCK_KEY);
    const nextStaffCode = await generateNextStaffCode(client);
    const result = await client.query(
      `
      INSERT INTO tbl_staff (
        id_user, id_staff_grade, staff_code, join_date, exit_date,
        created_by, last_modify_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $6
      )
      RETURNING id_staff;
      `,
      [idUser, req.body.id_staff_grade || null, nextStaffCode, joinDate, null, actorId]
      );
      const idStaff = result.rows[0].id_staff;

      // Sync officer role history automatically
      await syncStaffOfficerRole(client, idStaff, req.body.id_staff_grade, actorId);

      await deactivateRoleByNames(client, idUser, ["ADMIN", "STAFF", "CASHIER"], actorId);
      await assignRoleByName(client, idUser, accessRole, actorId);
      await logActivity(client, req, {
      idUser: actorId,
      activityType: "CREATE_STAFF",
      tableName: "tbl_staff",
      recordId: idStaff,
      description: `Created staff ${nextStaffCode}.`,
      });
    await client.query("COMMIT");
    return res.status(201).json({ message: "Staff created successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to create staff.", error: error.message });
  } finally {
    client.release();
  }
};

const updateStaff = async (req, res) => {
  const client = await pool.connect();
  try {
    const actorId = req.user.id_user;
    const accessRole = String(req.body.access_role || "").trim().toUpperCase();
    const joinDate = toDateOrNull(req.body.join_date);
    if (!["ADMIN", "STAFF", "CASHIER"].includes(accessRole)) throw new Error("access_role must be ADMIN, STAFF, or CASHIER.");
    if (!joinDate) throw new Error("join_date must use YYYY-MM-DD format.");

    await client.query("BEGIN");
    const current = await client.query(
      `
      SELECT id_user, staff_code
      FROM tbl_staff
      WHERE id_staff = $1;
      `,
      [req.params.id]
    );
    if (current.rowCount === 0) throw new Error("Staff not found.");
    await ensureProfile(client, req.body, current.rows[0].id_user, actorId);
    if (!current.rows[0].staff_code) {
      await acquireAdvisoryLock(client, STAFF_CODE_LOCK_KEY);
    }
    const nextStaffCode = current.rows[0].staff_code || (await generateNextStaffCode(client));
    const nextExitDate = toDateOrNull(req.body.exit_date);
    const nextIsActive = nextExitDate ? "N" : "Y";
    await client.query(
      `
      UPDATE tbl_staff
      SET id_staff_grade = $2,
          staff_code = $3,
          join_date = $4,
          exit_date = $5,
          is_active = $6,
          last_modify_date = NOW(),
          last_modify_by = $7
      WHERE id_staff = $1;
      `,
      [req.params.id, req.body.id_staff_grade || null, nextStaffCode, joinDate, nextExitDate, nextIsActive, actorId]
    );

    // Sync officer role history automatically
    await syncStaffOfficerRole(client, req.params.id, req.body.id_staff_grade, actorId);
    if (nextIsActive === "Y") {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["ADMIN", "STAFF", "CASHIER"], actorId);
      await assignRoleByName(client, current.rows[0].id_user, accessRole, actorId);
    } else {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["ADMIN", "STAFF", "CASHIER"], actorId);
    }
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "UPDATE_STAFF",
      tableName: "tbl_staff",
      recordId: req.params.id,
      description: `Updated staff ${nextStaffCode}.`,
    });
    await client.query("COMMIT");
    return res.json({ message: "Staff updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update staff.", error: error.message });
  } finally {
    client.release();
  }
};

const updateStaffStatus = async (req, res) => {
  const next = normalizeActive(req.body.is_active);
  if (!["Y", "N"].includes(next)) {
    return res.status(400).json({ message: "is_active must be Y or N." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `
      SELECT
        s.id_user,
        r.role_name AS access_role
      FROM tbl_staff s
      LEFT JOIN tbl_user_roles ur
        ON ur.id_user = s.id_user
       AND ur.is_active = 'Y'
      LEFT JOIN tbl_roles r
        ON r.id_role = ur.id_role
       AND r.role_name IN ('ADMIN', 'STAFF', 'CASHIER')
      WHERE s.id_staff = $1
      LIMIT 1;
      `,
      [req.params.id]
    );
    if (current.rowCount === 0) throw new Error("Staff not found.");
    await client.query(
      `
      UPDATE tbl_staff
      SET is_active = $2,
          exit_date = CASE WHEN $2 = 'N' THEN COALESCE(exit_date, CURRENT_DATE) ELSE NULL END,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE id_staff = $1;
      `,
      [req.params.id, next, req.user.id_user]
    );
    if (next === "Y") {
      await assignRoleByName(client, current.rows[0].id_user, current.rows[0].access_role || "STAFF", req.user.id_user);
    } else {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["ADMIN", "STAFF", "CASHIER"], req.user.id_user);
    }
    await logActivity(client, req, {
      idUser: req.user.id_user,
      activityType: next === "Y" ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF",
      tableName: "tbl_staff",
      recordId: req.params.id,
      description: `${next === "Y" ? "Activated" : "Deactivated"} staff.`,
    });
    await client.query("COMMIT");
    return res.json({ message: "Staff status updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update staff status.", error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listStaffs,
  createStaff,
  updateStaff,
  updateStaffStatus,
};
