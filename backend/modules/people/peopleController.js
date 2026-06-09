const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("../../config/db");
const { logActivity, logActivitySafe } = require("../../utils/activityLogger");

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_POLICY_MESSAGE = `password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase letters, lowercase letters, and numbers.`;
const MEMBER_CODE_LOCK_KEY = 830001;
const STAFF_CODE_LOCK_KEY = 830002;
const STAFF_GRADE_CODE_LOCK_KEY = 830003;
const uploadsRootDir = path.join(__dirname, "..", "..", "uploads");
const profileUploadsDir = path.join(uploadsRootDir, "profiles");

if (!fs.existsSync(profileUploadsDir)) {
  fs.mkdirSync(profileUploadsDir, { recursive: true });
}

const profileImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profileUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
}).single("image");

const parseProfileUploadFilePath = (profileImageValue) => {
  const raw = String(profileImageValue || "").trim();
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      pathname = parsed.pathname || "";
    } catch {
      pathname = raw;
    }
  }

  const normalized = pathname.replace(/\\/g, "/");
  const marker = "/uploads/profiles/";
  const index = normalized.toLowerCase().indexOf(marker);
  if (index < 0) return null;

  const fileName = normalized.slice(index + marker.length).split("/")[0];
  if (!fileName) return null;

  const safeFileName = path.basename(fileName);
  const resolved = path.resolve(profileUploadsDir, safeFileName);
  const rootResolved = path.resolve(profileUploadsDir);
  if (!resolved.startsWith(rootResolved)) return null;
  return resolved;
};

const removeUploadedProfileImageIfAny = (profileImageValue) => {
  const targetPath = parseProfileUploadFilePath(profileImageValue);
  if (!targetPath) return;
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};
const normalizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");
const normalizeActive = (value) => String(value || "").trim().toUpperCase();
const toDateOrNull = (value) => {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const fullNameSql = "TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))";

const acquireAdvisoryLock = (client, key) => client.query("SELECT pg_advisory_xact_lock($1::bigint);", [key]);

const validatePersonName = (value, fieldName, required = false) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) {
    if (required) throw new Error(`${fieldName} is required.`);
    return null;
  }
  if (!/^[\p{L}\s]+$/u.test(text)) {
    throw new Error(`${fieldName} may only contain letters and spaces.`);
  }
  return text;
};

const validatePhoneNumber = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (!/^[0-9+\-\s]{1,25}$/.test(text)) {
    throw new Error("phone_number may only contain digits, +, spaces, and hyphens.");
  }
  if ((text.match(/\+/g) || []).length > 1 || (text.includes("+") && !text.startsWith("+"))) {
    throw new Error("phone_number may only use + at the beginning.");
  }
  const digitCount = normalizeDigitsOnly(text).length;
  if (digitCount < 3 || digitCount > 20) {
    throw new Error("phone_number must contain 3 to 20 digits.");
  }
  return text;
};

const validatePasswordPolicy = (password, fieldName = "password") => {
  const value = String(password || "");
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[0-9]/.test(value)
  ) {
    throw new Error(PASSWORD_POLICY_MESSAGE.replace("password", fieldName));
  }
};

const assertUniqueEmail = async (client, email, ignoreUserId = null) => {
  const result = await client.query(
    `
    SELECT 1
    FROM tbl_users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
      AND ($2::uuid IS NULL OR id_user <> $2::uuid)
    LIMIT 1;
    `,
    [email, ignoreUserId]
  );
  if (result.rowCount > 0) {
    throw new Error("email is already used by another user.");
  }
};

const assertUniquePhoneNumber = async (client, phoneNumber, ignoreUserId = null) => {
  const normalizedPhoneDigits = normalizeDigitsOnly(phoneNumber);
  if (!normalizedPhoneDigits) return;

  const result = await client.query(
    `
    SELECT 1
    FROM tbl_profiles
    WHERE regexp_replace(COALESCE(phone_number, ''), '[^0-9]+', '', 'g') = $1
      AND ($2::uuid IS NULL OR id_user <> $2::uuid)
    LIMIT 1;
    `,
    [normalizedPhoneDigits, ignoreUserId]
  );
  if (result.rowCount > 0) {
    throw new Error("phone_number is already used by another profile.");
  }
};

const normalizeCodeWithDash = (value, prefix) => {
  const text = String(value || "").trim().toUpperCase();
  const match = text.match(new RegExp(`^${prefix}-?(\\d+)$`));
  if (!match) return text || null;
  return `${prefix}-${String(Number(match[1])).padStart(3, "0")}`;
};

const generateNextCode = async (client, tableName, columnName, prefix) => {
  const result = await client.query(
    `
    SELECT
      COALESCE(
        MAX(
          CASE
            WHEN ${columnName} ~ $1
              THEN CAST(REGEXP_REPLACE(${columnName}, $2, '', 'g') AS INTEGER)
            ELSE NULL
          END
        ),
        0
      ) AS max_seq
    FROM ${tableName};
    `,
    [`^${prefix}-?[0-9]+$`, `^${prefix}-?`]
  );
  const nextSeq = Number(result.rows[0]?.max_seq || 0) + 1;
  return `${prefix}-${String(nextSeq).padStart(3, "0")}`;
};

const generateNextMemberCode = (client) => generateNextCode(client, "tbl_members", "member_code", "MBR");
const generateNextStaffCode = (client) => generateNextCode(client, "tbl_staff", "staff_code", "STF");
const generateNextStaffGradeCode = (client) => generateNextCode(client, "tbl_staff_grades", "grade_code", "GRD");

const syncStaffOfficerRole = async (client, idStaff, idStaffGrade, actorId) => {
  if (!idStaffGrade) {
    // If grade is removed, terminate any active officer role
    await client.query(
      `
      UPDATE tbl_staff_officer_roles
      SET is_active = 'N',
          effective_end_date = CURRENT_DATE,
          last_modify_date = NOW(),
          last_modify_by = $2
      WHERE id_staff = $1
        AND is_active = 'Y'
        AND effective_end_date IS NULL;
      `,
      [idStaff, actorId]
    );
    return;
  }

  // 1. Get the grade name to see if it's an officer role
  const gradeResult = await client.query(
    "SELECT grade_name FROM tbl_staff_grades WHERE id_staff_grade = $1",
    [idStaffGrade]
  );
  if (gradeResult.rowCount === 0) return;

  const rawGradeName = String(gradeResult.rows[0].grade_name).toUpperCase().trim();
  let officerRoleCode = null;

  if (rawGradeName.includes("CHAIRPERSON") && !rawGradeName.includes("VICE")) {
    officerRoleCode = "CHAIRPERSON";
  } else if (rawGradeName.includes("VICE CHAIRPERSON")) {
    officerRoleCode = "VICE_CHAIRPERSON";
  } else if (rawGradeName.includes("TREASURER")) {
    officerRoleCode = "TREASURER";
  } else if (rawGradeName.includes("SUPERVISOR")) {
    officerRoleCode = "SUPERVISOR";
  } else if (rawGradeName.includes("ADVISOR")) {
    officerRoleCode = "ADVISOR";
  }

  // 2. Get current active officer role for this staff
  const currentRoleResult = await client.query(
    `
    SELECT officer_role_code
    FROM tbl_staff_officer_roles
    WHERE id_staff = $1
      AND is_active = 'Y'
      AND effective_end_date IS NULL
    LIMIT 1;
    `,
    [idStaff]
  );
  const currentRoleCode = currentRoleResult.rows[0]?.officer_role_code || null;

  // 3. If the role changed, sync
  if (officerRoleCode !== currentRoleCode) {
    // a. Terminate any previous role for this staff
    await client.query(
      `
      UPDATE tbl_staff_officer_roles
      SET is_active = 'N',
          effective_end_date = CURRENT_DATE,
          last_modify_date = NOW(),
          last_modify_by = $2
      WHERE id_staff = $1
        AND is_active = 'Y'
        AND effective_end_date IS NULL;
      `,
      [idStaff, actorId]
    );

    // b. If the new grade is an officer role
    if (officerRoleCode) {
      // Terminate ANYONE ELSE who is currently holding this specific role
      await client.query(
        `
        UPDATE tbl_staff_officer_roles
        SET is_active = 'N',
            effective_end_date = CURRENT_DATE,
            last_modify_date = NOW(),
            last_modify_by = $2
        WHERE officer_role_code = $1
          AND is_active = 'Y'
          AND effective_end_date IS NULL
          AND id_staff <> $3;
        `,
        [officerRoleCode, actorId, idStaff]
      );

      // Insert new role record
      await client.query(
        `
        INSERT INTO tbl_staff_officer_roles (
          id_staff, officer_role_code, effective_start_date, is_shu_eligible, is_active, created_by, last_modify_by
        ) VALUES (
          $1, $2, CURRENT_DATE, 'Y', 'Y', $3, $3
        );
        `,
        [idStaff, officerRoleCode, actorId]
      );
    }
  }
};

const ensureProfile = async (client, payload, idUser, actorId) => {
  const firstName = validatePersonName(payload.first_name, "first_name", true);
  const lastName = validatePersonName(payload.last_name, "last_name", false);
  const phoneNumber = validatePhoneNumber(payload.phone_number);
  await assertUniquePhoneNumber(client, phoneNumber, idUser);

  const hasProfileImage = Object.prototype.hasOwnProperty.call(payload, "profile_image");
  const profileImageValue = hasProfileImage ? normalizeText(payload.profile_image) : null;
  const profileImageUpdateSql = hasProfileImage ? "EXCLUDED.profile_image" : "tbl_profiles.profile_image";

  let oldImage = null;
  if (hasProfileImage) {
    const oldProfileResult = await client.query(
      `SELECT profile_image FROM tbl_profiles WHERE id_user = $1 LIMIT 1;`,
      [idUser]
    );
    if (oldProfileResult.rowCount > 0) {
      oldImage = oldProfileResult.rows[0].profile_image;
    }
  }

  const result = await client.query(
    `
    INSERT INTO tbl_profiles (
      id_user, first_name, last_name, phone_number, address, profile_image,
      created_by, last_modify_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $7
    )
    ON CONFLICT (id_user) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone_number = EXCLUDED.phone_number,
      address = EXCLUDED.address,
      profile_image = ${profileImageUpdateSql},
      is_active = 'Y',
      last_modify_date = NOW(),
      last_modify_by = EXCLUDED.last_modify_by
    RETURNING id_profile;
    `,
    [
      idUser,
      firstName,
      lastName,
      phoneNumber,
      normalizeText(payload.address),
      profileImageValue,
      actorId || null,
    ]
  );

  if (hasProfileImage && oldImage && oldImage !== profileImageValue) {
    removeUploadedProfileImageIfAny(oldImage);
  }

  return result.rows[0].id_profile;
};

const assignRoleByName = async (client, idUser, roleName, actorId) => {
  const normalizedRole = String(roleName || "").trim().toUpperCase();
  const roleResult = await client.query(
    `
    SELECT id_role
    FROM tbl_roles
    WHERE role_name = $1
      AND is_active = 'Y'
    LIMIT 1;
    `,
    [normalizedRole]
  );
  if (roleResult.rowCount === 0) throw new Error(`Role not found: ${normalizedRole}`);

  await client.query(
    `
    INSERT INTO tbl_user_roles (
      id_user, id_role, effective_start_date, effective_end_date,
      is_active, created_by, last_modify_by
    ) VALUES (
      $1, $2, CURRENT_DATE, NULL, 'Y', $3, $3
    )
    ON CONFLICT (id_user, id_role) DO UPDATE SET
      effective_start_date = CURRENT_DATE,
      effective_end_date = NULL,
      is_active = 'Y',
      last_modify_date = NOW(),
      last_modify_by = EXCLUDED.last_modify_by;
    `,
    [idUser, roleResult.rows[0].id_role, actorId || null]
  );
};

const deactivateRoleByNames = async (client, idUser, roleNames, actorId) => {
  const normalizedRoles = (Array.isArray(roleNames) ? roleNames : [roleNames])
    .map((roleName) => String(roleName || "").trim().toUpperCase())
    .filter(Boolean);
  if (normalizedRoles.length === 0) return;

  await client.query(
    `
    UPDATE tbl_user_roles ur
    SET is_active = 'N',
        effective_end_date = COALESCE(ur.effective_end_date, CURRENT_DATE),
        last_modify_date = NOW(),
        last_modify_by = $3
    FROM tbl_roles r
    WHERE r.id_role = ur.id_role
      AND ur.id_user = $1
      AND r.role_name = ANY($2)
      AND ur.is_active = 'Y';
    `,
    [idUser, normalizedRoles, actorId || null]
  );
};

const listRoles = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id_role, role_name, description, is_active
      FROM tbl_roles
      WHERE is_active = 'Y'
      ORDER BY
        CASE role_name
          WHEN 'ADMIN' THEN 1
          WHEN 'STAFF' THEN 2
          WHEN 'CASHIER' THEN 3
          WHEN 'MEMBER' THEN 4
          ELSE 99
        END,
        role_name ASC;
      `
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch roles.", error: error.message });
  }
};

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
    const actorId = req.body.actor_id || req.body.id_user || null;
    const idUser = req.params.id;

    await client.query("BEGIN");
    await ensureProfile(client, req.body, idUser, actorId);

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
  const actorId = req.body.actor_id || req.body.id_user || null;
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
  const actorId = req.body.actor_id || req.body.id_user || null;

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
  const actorId = req.body.id_user || req.body.actor_id || req.body.last_modify_by || null;

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
    const actorId = req.body.actor_id || req.body.id_user || null;

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
    const actorId = req.body.actor_id || req.body.id_user || null;

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
      [req.params.id, next, req.body.id_user || null]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "User not found." });
    await logActivitySafe(pool, req, {
      idUser: req.body.id_user || null,
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
    const actorId = req.body.actor_id || req.body.id_user || null;
    const joinDate = toDateOrNull(req.body.join_date) || new Date().toISOString().slice(0, 10);
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
    const actorId = req.body.actor_id || req.body.id_user || null;
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
      [req.params.id, next, req.body.id_user || req.body.actor_id || null]
    );
    if (next === "Y") {
      await assignRoleByName(client, current.rows[0].id_user, "MEMBER", req.body.id_user || req.body.actor_id || null);
    } else {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["MEMBER"], req.body.id_user || req.body.actor_id || null);
    }
    await logActivity(client, req, {
      idUser: req.body.id_user || req.body.actor_id || null,
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
    const actorId = req.body.actor_id || req.body.id_user || null;
    const accessRole = String(req.body.access_role || "").trim().toUpperCase();
    const joinDate = toDateOrNull(req.body.join_date) || new Date().toISOString().slice(0, 10);
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
    const actorId = req.body.actor_id || req.body.id_user || null;
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
      [req.params.id, next, req.body.actor_id || req.body.id_user || null]
    );
    if (next === "Y") {
      await assignRoleByName(client, current.rows[0].id_user, current.rows[0].access_role || "STAFF", req.body.actor_id || req.body.id_user || null);
    } else {
      await deactivateRoleByNames(client, current.rows[0].id_user, ["ADMIN", "STAFF", "CASHIER"], req.body.actor_id || req.body.id_user || null);
    }
    await logActivity(client, req, {
      idUser: req.body.actor_id || req.body.id_user || null,
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
      [req.params.id, next, req.body.id_user || req.body.actor_id || null]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: `${label} not found.` });
    await logActivitySafe(pool, req, {
      idUser: req.body.id_user || req.body.actor_id || null,
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
  listRoles,
  uploadProfileImage,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  listStaffGrades,
  createStaffGrade,
  updateStaffGrade,
  updateStaffGradeStatus,
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  listMembers,
  createMember,
  updateMember,
  updateMemberStatus,
  listStaffs,
  createStaff,
  updateStaff,
  updateStaffStatus,
};
