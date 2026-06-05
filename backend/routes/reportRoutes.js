const express = require("express");
const {
  listReportDataSources,
  runReport,
} = require("../modules/reports/reportsController");
const { sendEmailReport } = require("../modules/reports/emailController");

const router = express.Router();

router.get("/reports/sources", listReportDataSources);
router.get("/reports/run", runReport);
router.post("/reports/send-email", sendEmailReport);

module.exports = router;
