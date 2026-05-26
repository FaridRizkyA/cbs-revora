import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

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
  "/(main)/inventory/stock",
  "/inventory/stock",
  "/(main)/inventory/stock-in",
  "/inventory/stock-in",
  "/(main)/inventory/stock-out",
  "/inventory/stock-out",
  "/(main)/inventory/stock-out-manual",
  "/inventory/stock-out-manual",
  "/(main)/inventory/stock-adjustment",
  "/inventory/stock-adjustment",
  "/(main)/stock-movements/stock-in",
  "/stock-movements/stock-in",
  "/(main)/stock-movements/stock-out",
  "/stock-movements/stock-out",
  "/(main)/stock-movements/stock-out-manual",
  "/stock-movements/stock-out-manual",
  "/(main)/stock-movements/stock-adjustment",
  "/stock-movements/stock-adjustment",
]);

export const canCashierAccessMainPath = (pathname: string) => {
  if (pathname === "/(main)" || pathname === "/main" || pathname === "/") {
    return false;
  }

  return CASHIER_MAIN_ALLOWED_PATHS.has(pathname);
};


