const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  login,
  logout,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
} = require("../modules/auth/authController");

const router = express.Router();

router.post("/auth/login", login);
router.post("/auth/logout", authenticateToken, logout);
router.get("/auth/verify-session", authenticateToken, (req, res) => res.json({ message: "Session is valid.", user: req.user }));
router.post("/auth/password-reset/request-otp", requestPasswordResetOtp);
router.post("/auth/password-reset/verify-otp", verifyPasswordResetOtp);
router.post("/auth/password-reset/reset", resetPasswordWithOtp);

module.exports = router;
