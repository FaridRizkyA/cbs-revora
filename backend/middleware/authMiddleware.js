const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    // Attach the decoded user payload to the request object
    // so it can be accessed by the subsequent route handlers
    req.user = decoded;
    next();
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
