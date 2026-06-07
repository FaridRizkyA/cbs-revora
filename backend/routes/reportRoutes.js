const express = require("express");
const {
  listReportDataSources,
  runReport,
} = require("../modules/reports/reportsController");
const { sendEmailReport, exportExcelReport, exportPdfReport } = require("../modules/reports/emailController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/reports/sources", listReportDataSources);
router.get("/reports/run", runReport);
router.post("/reports/send-email", sendEmailReport);
router.post("/reports/export-excel", exportExcelReport);
router.post("/reports/export-pdf", exportPdfReport);

module.exports = router;
