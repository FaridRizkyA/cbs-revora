// User accounts.
const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { logActivity, logActivitySafe } = require("../../utils/activityLogger");
const { normalizeEmail, normalizeActive, validatePasswordPolicy, assertUniqueEmail } = require("./peopleShared");

const listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id_user,
        u.email,
        u.is_active,
        u.created_date AS created_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id_role', r.id_role, 'role_name', r.role_name)
            ORDER BY r.role_name
          ) FILTER (WHERE r.id_role IS NOT NULL),
          '[]'::json
        ) AS roles
      FROM tbl_users u
      LEFT JOIN tbl_user_roles ur
        ON ur.id_user = u.id_user
       AND ur.is_active = 'Y'
       AND ur.effective_start_date <= CURRENT_DATE
       AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
      LEFT JOIN tbl_roles r
        ON r.id_role = ur.id_role
       AND r.is_active = 'Y'
      GROUP BY u.id_user
      ORDER BY u.created_date DESC;
      `
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users.", error: error.message });
  }
};

const createUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const actorId = req.user.id_user;

    if (!email) throw new Error("email is required.");
    validatePasswordPolicy(password);

    await client.query("BEGIN");
    await assertUniqueEmail(client, email);
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `
      INSERT INTO tbl_users (email, password_hash, created_by, last_modify_by)
      VALUES ($1, $2, $3, $3)
      RETURNING id_user;
      `,
      [email, passwordHash, actorId]
    );
    const idUser = userResult.rows[0].id_user;
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "CREATE_USER",
      tableName: "tbl_users",
      recordId: idUser,
      description: `Created user ${email}.`,
    });
    await client.query("COMMIT");
    return res.status(201).json({ message: "User created successfully.", data: { id_user: idUser } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to create user.", error: error.message });
  } finally {
    client.release();
  }
};

const updateUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUser = req.params.id;
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const actorId = req.user.id_user;

    if (!email) throw new Error("email is required.");
    if (password) validatePasswordPolicy(password);

    await client.query("BEGIN");
    await assertUniqueEmail(client, email, idUser);
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await client.query(
        `
        UPDATE tbl_users
        SET email = $2,
            password_hash = $3,
            last_modify_date = NOW(),
            last_modify_by = $4
        WHERE id_user = $1;
        `,
        [idUser, email, passwordHash, actorId]
      );
    } else {
      await client.query(
        `
        UPDATE tbl_users
        SET email = $2,
            last_modify_date = NOW(),
            last_modify_by = $3
        WHERE id_user = $1;
        `,
        [idUser, email, actorId]
      );
    }
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "UPDATE_USER",
      tableName: "tbl_users",
      recordId: idUser,
      description: `Updated user ${email}.`,
    });
    await client.query("COMMIT");
    return res.json({ message: "User updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update user.", error: error.message });
  } finally {
    client.release();
  }
};

const updateUserStatus = async (req, res) => {
  const next = normalizeActive(req.body.is_active);
  if (!["Y", "N"].includes(next)) {
    return res.status(400).json({ message: "is_active must be Y or N." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_users
      SET is_active = $2,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE id_user = $1
      RETURNING id_user, email, is_active;
      `,
      [req.params.id, next, req.user.id_user]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "User not found." });
    await logActivitySafe(pool, req, {
      idUser: req.user.id_user,
      activityType: next === "Y" ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      tableName: "tbl_users",
      recordId: result.rows[0].id_user,
      description: `${next === "Y" ? "Activated" : "Deactivated"} user ${result.rows[0].email}.`,
    });
    return res.json({ message: "User status updated successfully.", data: result.rows[0] });
  } catch (error) {
    return res.status(400).json({ message: "Failed to update user status.", error: error.message });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
};
