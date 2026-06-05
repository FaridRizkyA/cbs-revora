const express = require("express");
const {
  listExternalFinancialEntries,
  createExternalFinancialEntry,
  updateExternalFinancialEntry,
  updateExternalFinancialEntryStatus,
} = require("../modules/externalFinancial/externalFinancialController");

const router = express.Router();

router.get("/external-financial-entries", listExternalFinancialEntries);
router.post("/external-financial-entries", createExternalFinancialEntry);
router.put("/external-financial-entries/:id", updateExternalFinancialEntry);
router.patch("/external-financial-entries/:id/status", updateExternalFinancialEntryStatus);

module.exports = router;
