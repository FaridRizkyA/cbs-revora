// Cooperative members.
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { toLocalIsoDate } = require("../../utils/dateUtils");
const { MEMBER_CODE_LOCK_KEY, normalizeActive, toDateOrNull, fullNameSql, acquireAdvisoryLock, normalizeCodeWithDash, generateNextMemberCode, ensureProfile, assignRoleByName, deactivateRoleByNames } = require("./peopleShared");

const listMembers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        m.id_member,
        m.id_user,
        p.id_profile,
        m.member_code,
        m.join_date,
        m.total_spending::float AS total_spending,
        m.is_active,
        m.created_date AS created_at,
        u.email,
        p.first_name,
        p.last_name,
        ${fullNameSql} AS full_name,
        p.phone_number,
        p.address,
        p.profile_image
      FROM tbl_members m
      LEFT JOIN tbl_users u
        ON u.id_user = m.id_user
      LEFT JOIN tbl_profiles p
        ON p.id_user = m.id_user
      ORDER BY m.member_code ASC, m.created_date DESC;
      `
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch members.", error: error.message });
  }
};

const createMember = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUser = req.body.id_user;
    const actorId = req.user.id_user;
    const joinDate = toDateOrNull(req.body.join_date) || toLocalIsoDate();
    if (!idUser) throw new Error("id_user is required.");

    await client.query("BEGIN");
    await ensureProfile(client, req.body, idUser, actorId);
    await acquireAdvisoryLock(client, MEMBER_CODE_LOCK_KEY);
    const nextMemberCode = await generateNextMemberCode(client);
    const result = await client.query(
      `
      INSERT INTO tbl_members (
        id_user, member_code, join_date, created_by, last_modify_by
      ) VALUES (
        $1, $2, $3, $4, $4
      )
      RETURNING id_member;
      `,
      [idUser, nextMemberCode, joinDate, actorId]
    );
    await assignRoleByName(client, idUser, "MEMBER", actorId);
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "CREATE_MEMBER",
      tableName: "tbl_members",
      recordId: result.rows[0].id_member,
      description: `Created member ${nextMemberCode}.`,
    });
    await client.query("COMMIT");
    return res.status(201).json({ message: "Member created successfully.", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to create member.", error: error.message });
  } finally {
    client.release();
  }
};

const updateMember = async (req, res) => {
  const client = await pool.connect();
  try {
    const actorId = req.user.id_user;
    const joinDate = toDateOrNull(req.body.join_date);
    if (!joinDate) throw new Error("join_date must use YYYY-MM-DD format.");

    await client.query("BEGIN");
    const current = await client.query(
      `
      SELECT id_user, member_code
      FROM tbl_members
      WHERE id_member = $1;
      `,
      [req.params.id]
    );
    if (current.rowCount === 0) throw new Error("Member not found.");
    await ensureProfile(client, req.body, current.rows[0].id_user, actorId);
    if (!current.rows[0].member_code) {
      await acquireAdvisoryLock(client, MEMBER_CODE_LOCK_KEY);
    }
    const nextMemberCode = normalizeCodeWithDash(current.rows[0].member_code, "MBR") || (await generateNextMemberCode(client));
    await client.query(
      `
      UPDATE tbl_members
      SET member_code = $2,
          join_date = $3,
          last_modify_date = NOW(),
          last_modify_by = $4
      WHERE id_member = $1;
      `,
      [req.params.id, nextMemberCode, joinDate, actorId]
    );
    await logActivity(client, req, {
      idUser: actorId,
      activityType: "UPDATE_MEMBER",
      tableName: "tbl_members",
      recordId: req.params.id,
      description: `Updated member ${nextMemberCode}.`,
    });
    await client.query("COMMIT");
    return res.json({ message: "Member updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update member.", error: error.message });
  } finally {
    client.release();
  }
};

const updateMemberStatus = async (req, res) => {
  const next = normalizeActive(req.body.is_active);
  if (!["Y", "N"].includes(next)) {
    return res.status(400).json({ message: "is_active must be Y or N." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT id_user FROM tbl_members WHERE id_member = $1;", [req.params.id]);
    if (current.rowCount === 0) throw new Error("Member not found.");
    await client.query(
      `
      UPDATE tbl_members
      SET is_active = $2,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE id_member = $1;
      `,
      [req.params.id, next, req.user.id_user]
    );
    if (next === "Y") {
      await assignRoleByName(client, current.rows[0].id_user, "MEMBER", req.user.id_user);
    } else {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["MEMBER"], req.user.id_user);
    }
    await logActivity(client, req, {
      idUser: req.user.id_user,
      activityType: next === "Y" ? "ACTIVATE_MEMBER" : "DEACTIVATE_MEMBER",
      tableName: "tbl_members",
      recordId: req.params.id,
      description: `${next === "Y" ? "Activated" : "Deactivated"} member.`,
    });
    await client.query("COMMIT");
    return res.json({ message: "Member status updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update member status.", error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listMembers,
  createMember,
  updateMember,
  updateMemberStatus,
};
