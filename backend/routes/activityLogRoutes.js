const express = require("express");
const {
  createClientActivityLog,
  listActivityLogs,
} = require("../modules/activityLogs/activityLogController");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/activity-logs", requireAccess("viewLogs"), listActivityLogs);
router.post("/activity-logs/client", requireAccess("authenticated"), createClientActivityLog);

module.exports = router;
