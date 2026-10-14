const express = require("express");
const {
  summaryCard,
  graphs,
  recentTransaction,
} = require("../modules/dashboard/dashboardController");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/dashboard/summaryCard", requireAccess("backOffice"), summaryCard);
router.get("/dashboard/graphs", requireAccess("backOffice"), graphs);
router.get("/dashboard/recentTransaction", requireAccess("backOffice"), recentTransaction);

module.exports = router;
