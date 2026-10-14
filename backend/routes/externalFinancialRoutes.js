const express = require("express");
const {
  listExternalFinancialEntries,
  createExternalFinancialEntry,
  updateExternalFinancialEntry,
  updateExternalFinancialEntryStatus,
} = require("../modules/externalFinancial/externalFinancialController");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/external-financial-entries", requireAccess("viewExternalFinancial"), listExternalFinancialEntries);
router.post("/external-financial-entries", requireAccess("manageExternalFinancial"), createExternalFinancialEntry);
router.put("/external-financial-entries/:id", requireAccess("manageExternalFinancial"), updateExternalFinancialEntry);
router.patch("/external-financial-entries/:id/status", requireAccess("manageExternalFinancial"), updateExternalFinancialEntryStatus);

module.exports = router;
