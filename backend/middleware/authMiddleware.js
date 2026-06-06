const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer <token>"

  if (!token) {
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
      const result = await pool.query(
        `
        SELECT active_session_jti, active_session_expires_at
        FROM tbl_users
        WHERE id_user = $1
          AND is_active = 'Y'
        LIMIT 1;
        `,
        [decoded.id_user]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({ message: "Invalid or expired token." });
      }

      const user = result.rows[0];
      if (
        decoded.jti &&
        (!user.active_session_jti ||
          user.active_session_jti !== decoded.jti ||
          !user.active_session_expires_at ||
          new Date(user.active_session_expires_at) <= new Date())
      ) {
        return res.status(403).json({ message: "Session expired. Please sign in again." });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify session.", error: error.message });
    }
  });
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role_name) {
      return res.status(403).json({ message: "Access denied. Role not found." });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
