const express = require("express");
const {
  summaryCard,
  graphs,
  recentTransaction,
} = require("../modules/dashboard/dashboardController");

const router = express.Router();

router.get("/dashboard/summaryCard", summaryCard);
router.get("/dashboard/graphs", graphs);
router.get("/dashboard/recentTransaction", recentTransaction);

module.exports = router;
