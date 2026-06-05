const express = require("express");
const {
  getCurrentShuSimulation,
  calculateCurrentShu,
  finalizeCurrentShu,
  getCurrentShuResult,
  getCurrentShuDetail,
  getShuYearlySummary,
} = require("../modules/shu/shuController");

const router = express.Router();

router.get("/shu/simulate-current", getCurrentShuSimulation);
router.post("/shu/calculate-current", calculateCurrentShu);
router.post("/shu/finalize-current", finalizeCurrentShu);
router.get("/shu/current-result", getCurrentShuResult);
router.get("/shu/current-detail", getCurrentShuDetail);
router.get("/shu/yearly-summary", getShuYearlySummary);

module.exports = router;
