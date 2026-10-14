const express = require("express");
const {
  listReportDataSources,
  runReport,
} = require("../modules/reports/reportsController");
const { sendEmailReport, exportExcelReport, exportPdfReport } = require("../modules/email/emailController");
const { authenticateToken } = require("../middleware/authMiddleware");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.use(authenticateToken);

router.get("/reports/sources", requireAccess("backOffice"), listReportDataSources);
router.get("/reports/run", requireAccess("backOffice"), runReport);
router.post("/reports/send-email", requireAccess("backOffice"), sendEmailReport);
router.post("/reports/export-excel", requireAccess("authenticated"), exportExcelReport);
router.post("/reports/export-pdf", requireAccess("authenticated"), exportPdfReport);

module.exports = router;
