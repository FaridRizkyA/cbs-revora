const express = require("express");
const {
  listReportDataSources,
  runReport,
} = require("../modules/reports/reportsController");
const { sendEmailReport, exportExcelReport } = require("../modules/reports/emailController");

const router = express.Router();

router.get("/reports/sources", listReportDataSources);
router.get("/reports/run", runReport);
router.post("/reports/send-email", sendEmailReport);
router.post("/reports/export-excel", exportExcelReport);

module.exports = router;
