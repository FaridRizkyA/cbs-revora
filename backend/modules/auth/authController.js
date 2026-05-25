const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");

const resolveCredential = (body) => {
  const candidate = body.identifier ?? body.username ?? body.email ?? "";
  return String(candidate).trim();
};

const login = async (req, res) => {
  const identifier = resolveCredential(req.body);
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    return res.status(400).json({
      message: "identifier and password are required.",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        u.id_user,
        u.id_role,
        u.full_name,
        u.username,
        u.email,
        u.password_hash,
        u.is_active,
        r.role_name
      FROM tbl_users u
      JOIN tbl_roles r
        ON r.id_role = u.id_role
      WHERE (u.username = $1 OR u.email = $1)
      LIMIT 1;
      `,
      [identifier]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "Invalid username/email or password.",
      });
    }

    const user = result.rows[0];

    if (user.is_active !== "Y") {
      return res.status(403).json({
        message: "User account is inactive.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatched) {
      return res.status(401).json({
        message: "Invalid username/email or password.",
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
        role_name: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    return res.json({
      message: "Login successful.",
      data: {
        token,
        user: {
          id_user: user.id_user,
          id_role: user.id_role,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role_name: user.role_name,
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
