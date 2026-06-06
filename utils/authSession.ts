import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./api";

export type AuthUser = {
  id_user: string;
  id_role: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  email: string | null;
  role_name: string;
  profile_image?: string | null;
  staff_grade_name?: string | null;
  staff_grade_code?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  expires_at?: string | null;
};

const AUTH_SESSION_KEY = "cbs_revora_auth_session";
const sessionListeners = new Set<(session: AuthSession | null) => void>();

const canUseWebStorage = () => Platform.OS === "web" && typeof localStorage !== "undefined";

const setSessionRaw = async (value: string) => {
  if (canUseWebStorage()) {
    localStorage.setItem(AUTH_SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(AUTH_SESSION_KEY, value);
};

const getSessionRaw = async () => {
  if (canUseWebStorage()) {
    return localStorage.getItem(AUTH_SESSION_KEY);
  }

  return SecureStore.getItemAsync(AUTH_SESSION_KEY);
};

const clearSessionRaw = async () => {
  if (canUseWebStorage()) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
};

export const saveAuthSession = async (session: AuthSession) => {
  await setSessionRaw(JSON.stringify(session));
  sessionListeners.forEach((listener) => listener(session));
};

export const getAuthSession = async (): Promise<AuthSession | null> => {
  const raw = await getSessionRaw();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await clearSessionRaw();
    return null;
  }
};

export const clearAuthSession = async () => {
  await clearSessionRaw();
  sessionListeners.forEach((listener) => listener(null));
};

export const clearAuthSessionLocal = clearAuthSession;

export const logoutAuthSession = async () => {
  const session = await getAuthSession();
  if (session?.token) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
    }).catch(() => null);
  }
  await clearAuthSession();
};

export const isAuthSessionExpired = (session: AuthSession | null) => {
  if (!session?.expires_at) return false;
  const expiryTime = new Date(session.expires_at).getTime();
  return Number.isFinite(expiryTime) && expiryTime <= Date.now();
};

export const subscribeAuthSession = (listener: (session: AuthSession | null) => void) => {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
};

export const getRouteByRole = (roleNameRaw: string | null | undefined) => {
  const roleName = String(roleNameRaw || "").trim().toUpperCase();

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
  return roleName === "CASHIER";
};

export const canAccessCashierModeWithGrade = (
  roleNameRaw: string | null | undefined,
  staffGradeNameRaw: string | null | undefined
) => {
  const roleName = normalizeRole(roleNameRaw);
  if (roleName === "CASHIER") {
    return true;
  }

  const gradeName = String(staffGradeNameRaw || "").trim().toUpperCase();
  return gradeName.includes("OPERATIONAL STAFF");
};

export const canAccessMainApp = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canManageInventoryMaster = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "STAFF" || roleName === "ADMIN";
};

export const canViewInventory = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canManagePeople = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "ADMIN";
};

export const canViewPeople = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "STAFF" || roleName === "ADMIN";
};

export const canManageExternalFinancial = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "ADMIN";
};

export const canViewExternalFinancial = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "STAFF" || roleName === "ADMIN";
};

export const canManageShu = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "ADMIN";
};

export const canViewShu = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "STAFF" || roleName === "ADMIN";
};

export const canAccessReports = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canAccessLogs = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "ADMIN";
};

export const canInsertStockMovement = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "CASHIER" || roleName === "STAFF" || roleName === "ADMIN";
};

export const canManageStockMovementRecord = (roleNameRaw: string | null | undefined) => {
  const roleName = normalizeRole(roleNameRaw);
  return roleName === "ADMIN";
};

const CASHIER_MAIN_ALLOWED_PATHS = new Set([
  "/(main)/dashboard",
  "/dashboard",
  "/(main)/inventory/products",
  "/inventory/products",
  "/(main)/inventory/suppliers",
  "/inventory/suppliers",
  "/(main)/inventory/batches",
  "/inventory/batches",
  "/(main)/stock-movements/stock-in",
  "/stock-movements/stock-in",
  "/(main)/stock-movements/stock-out",
  "/stock-movements/stock-out",
  "/(main)/stock-movements/sales",
  "/stock-movements/sales",
  "/(main)/sales/items",
  "/sales/items",
  "/(main)/sales/costs",
  "/sales/costs",
  "/(main)/stock-movements/stock-out-manual",
  "/stock-movements/stock-out-manual",
  "/(main)/stock-movements/stock-adjustment",
  "/stock-movements/stock-adjustment",
  "/(main)/reports",
  "/reports",
  "/profile",
]);

export const canCashierAccessMainPath = (pathname: string) => {
  if (pathname === "/(main)" || pathname === "/main" || pathname === "/") {
    return false;
  }

  return CASHIER_MAIN_ALLOWED_PATHS.has(pathname);
};

const MEMBER_ALLOWED_PATHS = new Set([
  "/(member)/dashboard",
  "/dashboard",
  "/(member)/transactions",
  "/transactions",
  "/(member)/shu",
  "/shu",
  "/(member)/profile",
  "/profile",
]);

export const canAccessMemberPath = (pathname: string) => {
  if (pathname === "/(member)" || pathname === "/member" || pathname === "/") {
    return false;
  }

  // Handle nested or dynamic paths if any, otherwise exact match
  return MEMBER_ALLOWED_PATHS.has(pathname);
};

export const canAccessMainPath = (roleNameRaw: string | null | undefined, pathname: string) => {
  const roleName = normalizeRole(roleNameRaw);
  if (!canAccessMainApp(roleName)) return false;

  if (pathname === "/(main)" || pathname === "/main" || pathname === "/") {
    return roleName !== "CASHIER";
  }

  if (roleName === "CASHIER") return canCashierAccessMainPath(pathname);

  if (pathname.startsWith("/(main)/users") || pathname.startsWith("/(main)/members") || pathname.startsWith("/(main)/staffs")) {
    return canViewPeople(roleName);
  }
  if (pathname.startsWith("/(main)/external-financial")) return canViewExternalFinancial(roleName);
  if (pathname.startsWith("/(main)/shu")) return canViewShu(roleName);
  if (pathname.startsWith("/(main)/logs")) return canAccessLogs(roleName);
  if (pathname.startsWith("/(main)/reports")) return canAccessReports(roleName);

  return true;
};

