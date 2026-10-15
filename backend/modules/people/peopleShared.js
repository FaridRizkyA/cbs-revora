// Validation, code generation, profile and role helpers shared by the people controllers.
const fs = require("fs");
const path = require("path");
const multer = require("multer");

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

module.exports = {
  profileImageUpload,
  fullNameSql,
  validatePasswordPolicy,
  ensureProfile,
  STAFF_GRADE_CODE_LOCK_KEY,
  normalizeText,
  normalizeActive,
  acquireAdvisoryLock,
  generateNextStaffGradeCode,
  normalizeEmail,
  assertUniqueEmail,
  MEMBER_CODE_LOCK_KEY,
  toDateOrNull,
  normalizeCodeWithDash,
  generateNextMemberCode,
  assignRoleByName,
  deactivateRoleByNames,
  STAFF_CODE_LOCK_KEY,
  generateNextStaffCode,
  syncStaffOfficerRole,
};
