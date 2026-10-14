const express = require("express");
const {
  getCurrentShuSimulation,
  calculateCurrentShu,
  finalizeCurrentShu,
  getCurrentShuResult,
  getCurrentShuDetail,
  getShuYearlySummary,
} = require("../modules/shu/shuController");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/shu/simulate-current", requireAccess("viewShu"), getCurrentShuSimulation);
router.post("/shu/calculate-current", requireAccess("calculateShu"), calculateCurrentShu);
router.post("/shu/finalize-current", requireAccess("finalizeShu"), finalizeCurrentShu);
router.get("/shu/current-result", requireAccess("viewShu"), getCurrentShuResult);
router.get("/shu/current-detail", requireAccess("viewShu"), getCurrentShuDetail);
router.get("/shu/yearly-summary", requireAccess("viewShu"), getShuYearlySummary);

module.exports = router;
