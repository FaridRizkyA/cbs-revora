const STOCK_MOVEMENT_ALLOWED_ROLES = new Set(["CASHIER", "STAFF", "ADMIN"]);
const CASHIER_CHECKOUT_ALLOWED_ROLES = new Set(["CASHIER", "STAFF", "ADMIN"]);
const INVENTORY_MASTER_ALLOWED_ROLES = new Set(["STAFF", "ADMIN"]);

const normalizeText = (value) => String(value || "").trim().toUpperCase();

const isOperationalStaffGrade = (gradeName) => {
  const normalizedGrade = normalizeText(gradeName);
  return normalizedGrade.includes("OPERATIONAL STAFF");
};

const getActiveUserRole = async (client, idUser) => {
  const userResult = await client.query(
    `
    SELECT
      u.id_user,
      UPPER(TRIM(COALESCE(r.role_name, ''))) AS role_name,
      sg.grade_name AS staff_grade_name
    FROM tbl_users u
    LEFT JOIN tbl_user_roles ur
      ON ur.id_user = u.id_user
     AND ur.is_active = 'Y'
     AND ur.effective_start_date <= CURRENT_DATE
     AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
    LEFT JOIN tbl_roles r
      ON r.id_role = ur.id_role
    LEFT JOIN LATERAL (
      SELECT g.grade_name
      FROM tbl_staff s
      LEFT JOIN tbl_staff_grades g
        ON g.id_staff_grade = s.id_staff_grade
      WHERE s.id_user = u.id_user
        AND s.is_active = 'Y'
      ORDER BY s.created_date DESC
      LIMIT 1
    ) sg ON TRUE
    WHERE u.id_user = $1
      AND u.is_active = 'Y'
    ORDER BY
      CASE UPPER(TRIM(COALESCE(r.role_name, '')))
        WHEN 'ADMIN' THEN 1
        WHEN 'CASHIER' THEN 2
        WHEN 'STAFF' THEN 3
        WHEN 'MEMBER' THEN 4
        ELSE 99
      END ASC,
      ur.created_date DESC NULLS LAST
    LIMIT 1;
    `,
    [idUser]
  );

  if (userResult.rowCount === 0) {
    throw new Error("User not found or inactive.");
  }

  return userResult.rows[0];
};

const assertInventoryMasterRole = (roleName) => {
  if (!INVENTORY_MASTER_ALLOWED_ROLES.has(roleName)) {
    throw new Error("User role is not allowed to manage inventory master.");
  }
};

const canAccessCashierModeRole = (roleName, staffGradeName) => {
  const normalizedRole = normalizeText(roleName);
  if (normalizedRole === "CASHIER") {
    return true;
  }

  return isOperationalStaffGrade(staffGradeName);
};

module.exports = {
  STOCK_MOVEMENT_ALLOWED_ROLES,
  CASHIER_CHECKOUT_ALLOWED_ROLES,
  INVENTORY_MASTER_ALLOWED_ROLES,
  getActiveUserRole,
  assertInventoryMasterRole,
  isOperationalStaffGrade,
  canAccessCashierModeRole,
};
