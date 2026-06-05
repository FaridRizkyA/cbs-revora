const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");
const { logActivitySafe } = require("../../utils/activityLogger");

const resolveCredential = (body) => {
  const candidate = body.email ?? body.identifier ?? "";
  return String(candidate).trim();
};

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
        message: "Invalid email or password.",
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
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured.",
      });
    }

    const token = jwt.sign(
      {
        id_user: user.id_user,
        id_role: user.id_role,
        role_name: user.role_name || "MEMBER",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
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

module.exports = {
  login,
};
