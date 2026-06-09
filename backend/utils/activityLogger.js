const pool = require("../config/db");

const getRequestIp = (req) =>
  req?.headers?.["x-forwarded-for"]?.split?.(",")?.[0]?.trim?.() ||
  req?.ip ||
  req?.socket?.remoteAddress ||
  null;

const logActivity = async (
  db,
  req,
  {
    idUser,
    activityType,
    tableName = null,
    recordId = null,
    description = null,
  }
) => {
  if (!activityType) return;

  const finalIdUser = idUser || req?.user?.id_user || null;
  const executor = db || pool;
  await executor.query(
    `
    INSERT INTO tbl_activity_logs (
      id_user,
      activity_type,
      table_name,
      record_id,
      description,
      ip_address,
      user_agent,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $1);
    `,
    [
      finalIdUser,
      activityType,
      tableName,
      recordId || null,
      description,
      getRequestIp(req),
      req?.get?.("user-agent") || req?.headers?.["user-agent"] || null,
    ]
  );
};

const logActivitySafe = async (db, req, payload) => {
  try {
    await logActivity(db, req, payload);
  } catch (error) {
    console.warn("Failed to write activity log:", error.message);
  }
};

module.exports = {
  logActivity,
  logActivitySafe,
};
