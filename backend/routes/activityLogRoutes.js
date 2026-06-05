const express = require("express");
const {
  createClientActivityLog,
  listActivityLogs,
} = require("../modules/activityLogs/activityLogController");

const router = express.Router();

router.get("/activity-logs", listActivityLogs);
router.post("/activity-logs/client", createClientActivityLog);

module.exports = router;
