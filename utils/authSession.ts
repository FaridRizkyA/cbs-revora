import { Platform } from "react-native";

export type AuthUser = {
  id_user: string;
  id_role: string;
  full_name: string;
  username: string;
  email: string | null;
  role_name: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const AUTH_SESSION_KEY = "cbs_revora_auth_session";

const canUseWebStorage = () => Platform.OS === "web" && typeof localStorage !== "undefined";

export const saveAuthSession = async (session: AuthSession) => {
  if (!canUseWebStorage()) {
    return;
  }

  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
};

export const getAuthSession = async (): Promise<AuthSession | null> => {
  if (!canUseWebStorage()) {
    return null;
  }

  const raw = localStorage.getItem(AUTH_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
};

export const clearAuthSession = async () => {
  if (!canUseWebStorage()) {
    return;
  }

  localStorage.removeItem(AUTH_SESSION_KEY);
};

export const getRouteByRole = (roleNameRaw: string | null | undefined) => {
  const roleName = String(roleNameRaw || "").toUpperCase();

  if (roleName === "CASHIER") {
    return "/(cashier)";
  }

  if (roleName === "MEMBER") {
    return "/(member)/dashboard";
  }

  return "/(main)/dashboard";
};

export const normalizeRole = (roleNameRaw: string | null | undefined) =>
  String(roleNameRaw || "").trim().toUpperCase();

export const canAccessCashierMode = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canAccessMainApp = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canManageInventoryMaster = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "STAFF" || roleName === "ADMIN";
};

const CASHIER_MAIN_ALLOWED_PATHS = new Set([
  "/(main)/dashboard",
  "/(main)/inventory/products",
  "/(main)/inventory/producers",
  "/(main)/inventory/batches",
  "/(main)/inventory/stock",
  "/(main)/inventory/stock-in",
  "/(main)/inventory/stock-out",
  "/(main)/inventory/stock-adjustment",
]);

export const canCashierAccessMainPath = (pathname: string) => {
  if (pathname === "/(main)") {
    return false;
  }

  return CASHIER_MAIN_ALLOWED_PATHS.has(pathname);
};
