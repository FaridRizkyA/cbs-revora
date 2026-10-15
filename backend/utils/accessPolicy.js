// Server-side access policy. Mirrors the permission helpers in utils/authSession.ts
// so the API enforces the same rules the UI shows.

const normalize = (value) => String(value || "").trim().toUpperCase();

const roleOf = (user) => normalize(user?.role_name);
const gradeOf = (user) => normalize(user?.staff_grade_name);
const officerRolesOf = (user) => (Array.isArray(user?.officer_roles) ? user.officer_roles.map(normalize) : []);

const isAdmin = (user) => roleOf(user) === "ADMIN";
const isStaff = (user) => roleOf(user) === "STAFF";
const isCashier = (user) => roleOf(user) === "CASHIER";
const isOperationalStaff = (user) => gradeOf(user).includes("OPERATIONAL STAFF");
const isTreasurer = (user) =>
  gradeOf(user).includes("TREASURER") || gradeOf(user).includes("BENDAHARA") || officerRolesOf(user).includes("TREASURER");

// Back-office roles that may open the main app (everyone except members).
const isBackOffice = (user) => isAdmin(user) || isStaff(user) || isCashier(user);

const policies = {
  backOffice: isBackOffice,
  cashierMode: (user) => isCashier(user) || isOperationalStaff(user),
  manageInventoryMaster: (user) => isAdmin(user) || (isStaff(user) && isOperationalStaff(user)),
  insertStockMovement: (user) => isAdmin(user) || isCashier(user) || (isStaff(user) && isOperationalStaff(user)),
  viewPeople: (user) => isAdmin(user) || isStaff(user),
  managePeople: isAdmin,
  viewExternalFinancial: (user) => isAdmin(user) || isStaff(user),
  manageExternalFinancial: (user) => isAdmin(user) || (isStaff(user) && isTreasurer(user)),
  viewShu: (user) => isAdmin(user) || isStaff(user),
  // Same people who may finalize may (re)calculate; the SHU page shows both actions together.
  calculateShu: (user) => isAdmin(user) || isTreasurer(user),
  finalizeShu: (user) => isAdmin(user) || isTreasurer(user),
  viewLogs: isAdmin,
  authenticated: (user) => Boolean(user?.id_user),
};

// Express middleware: allow the request only when the named policy passes.
const requireAccess = (policyName) => {
  const check = policies[policyName];
  if (!check) throw new Error(`Unknown access policy: ${policyName}`);
  return (req, res, next) => {
    if (check(req.user)) return next();
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  };
};

// Middleware for /people/users/:id/... routes a user may call on their own account.
const requireSelfOrAdmin = (req, res, next) => {
  if (isAdmin(req.user) || String(req.params.id) === String(req.user?.id_user)) return next();
  return res.status(403).json({ message: "Access denied. You can only change your own account." });
};

module.exports = {
  policies,
  requireAccess,
  requireSelfOrAdmin,
};
