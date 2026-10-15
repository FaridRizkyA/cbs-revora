// Own profile, profile photo upload and password change.
const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { logActivity, logActivitySafe } = require("../../utils/activityLogger");
const { profileImageUpload, fullNameSql, validatePasswordPolicy, ensureProfile } = require("./peopleShared");

const uploadProfileImage = (req, res) => {
  profileImageUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: "Failed to upload profile image.", error: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: "image file is required." });
    }

    const relativePath = `uploads/profiles/${req.file.filename}`.replace(/\\/g, "/");
    const imageUrl = `${req.protocol}://${req.get("host")}/${relativePath}`;
    return res.status(201).json({
      message: "Profile image uploaded successfully.",
      data: {
        file_name: req.file.filename,
        file_path: relativePath,
        image_url: imageUrl,
      },
    });
  });
};

const getUserProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id_user,
        u.email,
        u.is_active,
        p.id_profile,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.address,
        p.profile_image,
        ${fullNameSql} AS full_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id_role', r.id_role, 'role_name', r.role_name)
            ORDER BY r.role_name
          ) FILTER (WHERE r.id_role IS NOT NULL),
          '[]'::json
        ) AS roles
      FROM tbl_users u
      LEFT JOIN tbl_profiles p
        ON p.id_user = u.id_user
      LEFT JOIN tbl_user_roles ur
        ON ur.id_user = u.id_user
       AND ur.is_active = 'Y'
       AND ur.effective_start_date <= CURRENT_DATE
       AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
      LEFT JOIN tbl_roles r
        ON r.id_role = ur.id_role
       AND r.is_active = 'Y'
      WHERE u.id_user = $1
      GROUP BY
        u.id_user,
        p.id_profile,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.address,
        p.profile_image,
        u.email,
        u.is_active
      LIMIT 1;
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Profile not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile.", error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  const client = await pool.connect();
  try {
    const actorId = req.user.id_user;
    const idUser = req.params.id;

    await client.query("BEGIN");
    const profileId = await ensureProfile(client, req.body, idUser, actorId);

    await logActivity(client, req, {
      idUser: actorId,
      activityType: "UPDATE_PROFILE",
      tableName: "tbl_profiles",
      recordId: profileId,
      description: `Updated profile for user ID: ${idUser}.`,
    });

    await client.query("COMMIT");
    return res.json({ message: "Profile updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to update profile.", error: error.message });
  } finally {
    client.release();
  }
};

const changeUserPassword = async (req, res) => {
  const idUser = req.params.id;
  const actorId = req.user.id_user;
  const currentPassword = String(req.body.current_password || "");
  const newPassword = String(req.body.new_password || "");
  const confirmPassword = String(req.body.confirm_password || "");

  if (!actorId || actorId !== idUser) {
    return res.status(403).json({ message: "You can only change your own password." });
  }
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Current password, new password, and confirmation are required." });
  }
  try {
    validatePasswordPolicy(newPassword, "New password");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password confirmation does not match." });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "New password must be different from current password." });
  }

  try {
    const result = await pool.query(
      `
      SELECT id_user, password_hash, is_active
      FROM tbl_users
      WHERE id_user = $1
      LIMIT 1;
      `,
      [idUser]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = result.rows[0];
    if (user.is_active !== "Y") {
      return res.status(403).json({ message: "User account is inactive." });
    }

    const passwordMatched = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatched) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `
      UPDATE tbl_users
      SET password_hash = $2,
          last_modify_date = NOW(),
          last_modify_by = $3
      WHERE id_user = $1;
      `,
      [idUser, passwordHash, actorId]
    );
    await logActivitySafe(pool, req, {
      idUser: actorId,
      activityType: "CHANGE_PASSWORD",
      tableName: "tbl_users",
      recordId: idUser,
      description: "User changed their password.",
    });

    return res.json({ message: "Password changed successfully." });
  } catch (error) {
    return res.status(400).json({ message: "Failed to change password.", error: error.message });
  }
};

module.exports = {
  uploadProfileImage,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
};
