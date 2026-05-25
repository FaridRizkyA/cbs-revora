const express = require("express");
const { login } = require("../modules/auth/authController");

const router = express.Router();

router.post("/auth/login", login);

module.exports = router;
