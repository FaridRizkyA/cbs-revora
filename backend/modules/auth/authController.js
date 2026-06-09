const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");
const { logActivitySafe } = require("../../utils/activityLogger");
const { sendEmail } = require("../../utils/mailer");

const TOKEN_EXPIRES_IN = "12h";
const TOKEN_DURATION_MS = 12 * 60 * 60 * 1000;
const OTP_DURATION_MINUTES = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase letters, lowercase letters, and numbers.";

const isValidPasswordPolicy = (password) =>
  String(password || "").length >= PASSWORD_MIN_LENGTH &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password);

const resolveCredential = (body) => {
  const candidate = body.email ?? body.identifier ?? "";
  return String(candidate).trim();
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const login = async (req, res) => {
  const identifier = resolveCredential(req.body);
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    return res.status(400).json({
      message: "email and password are required.",
    });
  }

  try {
    const result = await pool.query(
      `
      WITH ranked_roles AS (
        SELECT
          ur.id_user,
          ur.id_role,
          r.role_name,
          ROW_NUMBER() OVER (
            PARTITION BY ur.id_user
            ORDER BY
              CASE UPPER(TRIM(COALESCE(r.role_name, '')))
                WHEN 'ADMIN' THEN 1
                WHEN 'CASHIER' THEN 2
                WHEN 'STAFF' THEN 3
                WHEN 'MEMBER' THEN 4
                ELSE 99
              END ASC,
              ur.created_date DESC NULLS LAST
          ) AS rn
        FROM tbl_user_roles ur
        JOIN tbl_roles r
          ON r.id_role = ur.id_role
        WHERE ur.is_active = 'Y'
          AND ur.effective_start_date <= CURRENT_DATE
          AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
      )
      SELECT
        u.id_user,
        u.email,
        u.password_hash,
        u.is_active,
        u.active_session_jti,
        u.active_session_expires_at,
        p.first_name,
        p.last_name,
        p.profile_image,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        rr.id_role,
        rr.role_name,
        sg.id_staff_grade,
        sg.grade_code AS staff_grade_code,
        sg.grade_name AS staff_grade_name
      FROM tbl_users u
      LEFT JOIN tbl_profiles p
        ON p.id_user = u.id_user
       AND p.is_active = 'Y'
      LEFT JOIN LATERAL (
        SELECT
          s.id_staff_grade,
          g.grade_code,
          g.grade_name
        FROM tbl_staff s
        LEFT JOIN tbl_staff_grades g
          ON g.id_staff_grade = s.id_staff_grade
        WHERE s.id_user = u.id_user
          AND s.is_active = 'Y'
        ORDER BY s.created_date DESC
        LIMIT 1
      ) sg ON TRUE
      LEFT JOIN ranked_roles rr
        ON rr.id_user = u.id_user
       AND rr.rn = 1
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
      `,
      [identifier]
    );

    if (result.rowCount === 0) {
      await logActivitySafe(pool, req, {
        activityType: "LOGIN_FAILED",
        tableName: "tbl_users",
        description: `Failed login attempt for ${identifier}: account not found.`,
      });
      return res.status(401).json({
        message: "User not found.",
      });
    }

    const user = result.rows[0];

    if (user.is_active !== "Y") {
      await logActivitySafe(pool, req, {
        idUser: user.id_user,
        activityType: "LOGIN_FAILED",
        tableName: "tbl_users",
        recordId: user.id_user,
        description: `Failed login attempt for ${user.email}: inactive account.`,
      });
      return res.status(403).json({
        message: "User account is inactive.",
      });
    }

    if (!user.id_role || !user.role_name) {
      await logActivitySafe(pool, req, {
        idUser: user.id_user,
        activityType: "LOGIN_FAILED",
        tableName: "tbl_users",
        recordId: user.id_user,
        description: `Failed login attempt for ${user.email}: role is not assigned.`,
      });
      return res.status(403).json({
        message: "User account role is not assigned.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatched) {
      await logActivitySafe(pool, req, {
        idUser: user.id_user,
        activityType: "LOGIN_FAILED",
        tableName: "tbl_users",
        recordId: user.id_user,
        description: `Failed login attempt for ${user.email}: invalid password.`,
      });
      return res.status(401).json({
        message: "Invalid password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured.",
      });
    }

    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS);
    const token = jwt.sign(
      {
        id_user: user.id_user,
        id_role: user.id_role,
        role_name: user.role_name || "MEMBER",
        jti: tokenId,
      },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN }
    );

    await pool.query(
      `
      UPDATE tbl_users
      SET active_session_jti = $2,
          active_session_expires_at = $3,
          last_modify_date = NOW()
      WHERE id_user = $1;
      `,
      [user.id_user, tokenId, expiresAt]
    );

    await logActivitySafe(pool, req, {
      idUser: user.id_user,
      activityType: "LOGIN_SUCCESS",
      tableName: "tbl_users",
      recordId: user.id_user,
      description: `User ${user.email} logged in successfully.`,
    });

    return res.json({
      message: "Login successful.",
      data: {
        token,
        expires_at: expiresAt.toISOString(),
        user: {
          id_user: user.id_user,
          id_role: user.id_role,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name || user.email,
          email: user.email,
          role_name: user.role_name || "MEMBER",
          profile_image: user.profile_image,
          staff_grade_name: user.staff_grade_name || null,
          staff_grade_code: user.staff_grade_code || null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login failed.",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  const idUser = req.user?.id_user;
  const tokenId = req.user?.jti || null;

  if (!idUser) {
    return res.status(401).json({ message: "Session not found." });
  }

  try {
    await pool.query(
      `
      UPDATE tbl_users
      SET active_session_jti = NULL,
          active_session_expires_at = NULL,
          last_modify_date = NOW()
      WHERE id_user = $1
        AND ($2::text IS NULL OR active_session_jti = $2);
      `,
      [idUser, tokenId]
    );

    await logActivitySafe(pool, req, {
      idUser,
      activityType: "LOGOUT",
      tableName: "tbl_users",
      recordId: idUser,
      description: "User logged out successfully.",
    });

    return res.json({ message: "Logout successful." });
  } catch (error) {
    return res.status(400).json({ message: "Logout failed.", error: error.message });
  }
};

const requestPasswordResetOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        u.id_user, 
        u.email, 
        u.is_active,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''), u.email) AS full_name
      FROM tbl_users u
      LEFT JOIN tbl_profiles p ON p.id_user = u.id_user
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
      `,
      [email]
    );

    if (result.rowCount === 0 || result.rows[0].is_active !== "Y") {
      return res.status(404).json({ message: "User was not found." });
    }

    const user = result.rows[0];
    const otp = generateOtp();
    await pool.query(
      `
      INSERT INTO tbl_password_reset_otps (id_user, email, otp_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval);
      `,
      [user.id_user, user.email, hashOtp(otp), OTP_DURATION_MINUTES]
    );

    await logActivitySafe(pool, req, {
      idUser: user.id_user,
      activityType: "REQUEST_PASSWORD_RESET",
      tableName: "tbl_users",
      recordId: user.id_user,
      description: `User requested password reset OTP for ${user.email}.`,
    });

    const { renderTemplate } = require("../../utils/templateRenderer");
    const emailHtml = renderTemplate("OtpEmail", {
      RECIPIENT_NAME: user.full_name,
      OTP_CODE: otp,
      EXPIRY_MINUTES: OTP_DURATION_MINUTES,
    });

    await sendEmail({
      to: user.email,
      subject: "CBS Revora Password Reset OTP",
      html: emailHtml,
    });

    return res.json({ message: "OTP has been sent to your email." });
  } catch (error) {
    return res.status(400).json({ message: "Failed to send OTP.", error: error.message });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_password_reset_otps
      SET verified_at = NOW()
      WHERE id_password_reset_otp = (
        SELECT o.id_password_reset_otp
        FROM tbl_password_reset_otps o
        JOIN tbl_users u ON u.id_user = o.id_user
        WHERE LOWER(o.email) = LOWER($1)
          AND o.otp_hash = $2
          AND o.expires_at > NOW()
          AND o.used_at IS NULL
        ORDER BY o.created_date DESC
        LIMIT 1
      )
      RETURNING id_password_reset_otp;
      `,
      [email, hashOtp(otp)]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    return res.json({ message: "OTP verified successfully." });
  } catch (error) {
    return res.status(400).json({ message: "Failed to verify OTP.", error: error.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();
  const newPassword = String(req.body.new_password || "");
  const confirmPassword = String(req.body.confirm_password || "");

  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Email, OTP, new password, and confirmation are required." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Password confirmation does not match." });
  }
  if (!isValidPasswordPolicy(newPassword)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const otpResult = await client.query(
      `
      SELECT o.id_password_reset_otp, u.id_user
      FROM tbl_password_reset_otps o
      JOIN tbl_users u ON u.id_user = o.id_user
      WHERE LOWER(o.email) = LOWER($1)
        AND o.otp_hash = $2
        AND o.expires_at > NOW()
        AND o.used_at IS NULL
        AND o.verified_at IS NOT NULL
        AND u.is_active = 'Y'
      ORDER BY o.created_date DESC
      LIMIT 1
      FOR UPDATE OF o;
      `,
      [email, hashOtp(otp)]
    );

    if (otpResult.rowCount === 0) {
      throw new Error("Invalid or expired OTP.");
    }

    const row = otpResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await client.query(
      `
      UPDATE tbl_users
      SET password_hash = $2,
          active_session_jti = NULL,
          active_session_expires_at = NULL,
          last_modify_date = NOW()
      WHERE id_user = $1;
      `,
      [row.id_user, passwordHash]
    );
    await client.query(
      `
      UPDATE tbl_password_reset_otps
      SET used_at = NOW()
      WHERE id_password_reset_otp = $1;
      `,
      [row.id_password_reset_otp]
    );
    await logActivitySafe(client, req, {
      idUser: row.id_user,
      activityType: "RESET_PASSWORD",
      tableName: "tbl_users",
      recordId: row.id_user,
      description: "User reset password via OTP.",
    });
    await client.query("COMMIT");
    return res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(400).json({ message: "Failed to reset password.", error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  login,
  logout,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
};
