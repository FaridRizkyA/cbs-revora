const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authenticateToken = async (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer <token>"

  if (!token) {
    console.warn(`[Auth] Access denied for ${req.method} ${req.originalUrl}: No token provided.`);
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured." });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    try {
      // Role, grade and officer roles are read fresh so permission changes apply immediately.
      const result = await pool.query(
        `
        SELECT
          u.active_session_jti,
          u.active_session_expires_at,
          (
            SELECT UPPER(TRIM(r.role_name))
            FROM tbl_user_roles ur
            JOIN tbl_roles r ON r.id_role = ur.id_role
            WHERE ur.id_user = u.id_user
              AND ur.is_active = 'Y'
              AND ur.effective_start_date <= CURRENT_DATE
              AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
            ORDER BY
              CASE UPPER(TRIM(r.role_name))
                WHEN 'ADMIN' THEN 1
                WHEN 'CASHIER' THEN 2
                WHEN 'STAFF' THEN 3
                WHEN 'MEMBER' THEN 4
                ELSE 99
              END,
              ur.created_date DESC NULLS LAST
            LIMIT 1
          ) AS role_name,
          (
            SELECT g.grade_name
            FROM tbl_staff s
            JOIN tbl_staff_grades g ON g.id_staff_grade = s.id_staff_grade
            WHERE s.id_user = u.id_user
              AND s.is_active = 'Y'
            ORDER BY s.created_date DESC
            LIMIT 1
          ) AS staff_grade_name,
          ARRAY(
            SELECT UPPER(TRIM(sor.officer_role_code))
            FROM tbl_staff s
            JOIN tbl_staff_officer_roles sor ON sor.id_staff = s.id_staff
            WHERE s.id_user = u.id_user
              AND s.is_active = 'Y'
              AND sor.is_active = 'Y'
              AND sor.effective_start_date <= CURRENT_DATE
              AND (sor.effective_end_date IS NULL OR sor.effective_end_date >= CURRENT_DATE)
          ) AS officer_roles
        FROM tbl_users u
        WHERE u.id_user = $1
          AND u.is_active = 'Y'
        LIMIT 1;
        `,
        [decoded.id_user]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({ message: "Invalid or expired token." });
      }

      const user = result.rows[0];
      
      // 1. Check if session has been displaced by a newer login
      if (decoded.jti && user.active_session_jti && user.active_session_jti !== decoded.jti) {
        return res.status(403).json({ 
          message: "Account logged in on another device.",
          code: "SESSION_DISPLACED"
        });
      }

      // 1b. Check if session was explicitly revoked or cleared (e.g. via db:setup)
      if (decoded.jti && !user.active_session_jti) {
        return res.status(403).json({ 
          message: "Session has been revoked.",
          code: "SESSION_EXPIRED"
        });
      }

      // 2. Check if session has naturally expired
      if (!user.active_session_expires_at || new Date(user.active_session_expires_at) <= new Date()) {
        return res.status(403).json({ 
          message: "Session expired. Please sign in again.",
          code: "SESSION_EXPIRED"
        });
      }

      req.user = {
        ...decoded,
        role_name: user.role_name || null,
        staff_grade_name: user.staff_grade_name || null,
        officer_roles: user.officer_roles || [],
      };
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify session.", error: error.message });
    }
  });
};

module.exports = {
  authenticateToken,
};
