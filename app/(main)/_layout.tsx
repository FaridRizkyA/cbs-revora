import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppNavigationSidebar, { NavigationItem } from "../../components/navigation/AppNavigationSidebar";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import {
  canAccessMainApp,
  canAccessMainPath,
  canAccessCashierModeWithGrade,
  getAppMode,
  getAuthSession,
  getRouteByRole,
  isAuthSessionExpired,
  logoutAuthSession,
  normalizeRole,
  setAppMode,
  subscribeAppMode,
  subscribeAuthSession,
  AppMode,
} from "../../utils/authSession";

const SIDEBAR_LOGO = require("../../assets/images/ui/logo_horizontal.png");
const PROFILE_PLACEHOLDER = require("../../assets/images/placeholders/default-profile.png");

const MAIN_MENU_ADMIN_STAFF: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    children: ["Suppliers", "Products", "Product Batches"],
  },
  {
    key: "stock-movements",
    label: "Stock Movements",
    icon: "activity",
    children: ["Stock In", "Stock Out", "Stock Adjustment"],
  },
  {
    key: "sales",
    label: "Sales",
    icon: "shopping-cart",
    children: ["Sales Items", "Sales Cost"],
  },
  {
    key: "people",
    label: "People",
    icon: "users",
    children: ["Users", "Members", "Staffs"],
  },
  { key: "external-financial", label: "External Financials", icon: "dollar-sign" },
  { key: "shu", label: "SHU", icon: "pie-chart" },
  { key: "reports", label: "Reports", icon: "file-text" },
  { key: "logs", label: "Logs", icon: "clipboard" },
];

const MAIN_MENU_CASHIER: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    children: ["Suppliers", "Products", "Product Batches"],
  },
  {
    key: "stock-movements",
    label: "Stock Movements",
    icon: "activity",
    children: ["Stock In", "Stock Out", "Stock Adjustment"],
  },
  {
    key: "sales",
    label: "Sales",
    icon: "shopping-cart",
    children: ["Sales Items", "Sales Cost"],
  },
  { key: "reports", label: "Reports", icon: "file-text" },
];

const MAIN_MENU_MEMBER: NavigationItem[] = [
  { key: "member-dashboard", label: "Dashboard", icon: "grid" },
  { key: "member-transactions", label: "Transactions", icon: "list" },
  { key: "member-shu", label: "SHU History", icon: "pie-chart" },
];

const routeBySubmenu = (child: string) => {
  if (child === "Products") return "/(main)/inventory/products";
  if (child === "Suppliers") return "/(main)/inventory/suppliers";
  if (child === "Product Batches") return "/(main)/inventory/batches";
  if (child === "Stock In") return "/(main)/stock-movements/stock-in";
  if (child === "Stock Out") return "/(main)/stock-movements/stock-out";
  if (child === "Sales Items") return "/(main)/sales/items";
  if (child === "Sales Cost") return "/(main)/sales/costs";
  if (child === "Stock Adjustment") return "/(main)/stock-movements/stock-adjustment";
  if (child === "Users") return "/(main)/users";
  if (child === "Members") return "/(main)/members";
  if (child === "Staffs") return "/(main)/staffs";
  return "/(main)/dashboard";
};

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhoneLandscape = shortSide < 768 && width > height;
  const BASE_WIDTH = 1366;
  const BASE_HEIGHT = 768;
  const topPad = Math.max(insets.top, 12) + (isPhoneLandscape ? 14 : 0);
  const bottomPad = Math.max(insets.bottom, 8);
  const usableHeight = Math.max(height - topPad - bottomPad, 320);
  const appScale = Math.min(1, Math.min(width / BASE_WIDTH, usableHeight / BASE_HEIGHT));
  const [ready, setReady] = useState(false);
  const [appMode, setAppModeState] = useState<AppMode>("STAFF");
  const [roleName, setRoleName] = useState<string>("ADMIN");
  const [profileName, setProfileName] = useState<string>("User");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [staffGradeName, setStaffGradeName] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hasMemberAccess, setHasMemberAccess] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    inventory: true,
    "stock-movements": true,
    sales: true,
    people: true,
  });

  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleExpiryLogout = (expiresAt?: string | null) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      if (!expiresAt) return;
      const delay = new Date(expiresAt).getTime() - Date.now();
      if (!Number.isFinite(delay)) return;
      expiryTimer = setTimeout(async () => {
        if (!active) return;
        await logoutAuthSession();
        router.replace("/login?expired=1");
      }, Math.max(delay, 0));
    };

    const applySessionUser = (session: Awaited<ReturnType<typeof getAuthSession>>) => {
      const nextRole = normalizeRole(session?.user?.role_name);
      setRoleName(nextRole || "ADMIN");
      setProfileName(session?.user?.full_name || "User");
      setProfileImage(session?.user?.profile_image || null);
      setStaffGradeName(session?.user?.staff_grade_name || null);
    };

    const checkAuth = async () => {
      const session = await getAuthSession();
      const nextRole = normalizeRole(session?.user?.role_name);

      if (!session?.token || !nextRole) {
        router.replace("/login");
        return;
      }
      if (isAuthSessionExpired(session)) {
        await logoutAuthSession();
        router.replace("/login?expired=1");
        return;
      }

      if (!canAccessMainApp(nextRole)) {
        router.replace(getRouteByRole(nextRole));
        return;
      }

      if (!canAccessMainPath(nextRole, pathname)) {
        router.replace(nextRole === "CASHIER" ? "/(main)/inventory/products" : (nextRole === "MEMBER" ? "/(main)/portal/dashboard" : "/(main)/dashboard"));
        return;
      }

      if (!active) return;

      // Backend check to verify JTI displacement
      try {
        const verifyRes = await fetchWithAuth("/api/auth/verify-session");
        if (verifyRes.status === 401 || verifyRes.status === 403) {
          const payload = await verifyRes.json().catch(() => ({}));
          await logoutAuthSession();
          
          if (payload.code === "SESSION_DISPLACED") {
            router.replace("/login?displaced=1");
          } else {
            router.replace("/login?expired=1");
          }
          return;
        }
      } catch {
        // Network errors handled by allowing ready for now
      }

      const initialMode = await getAppMode();
      setAppModeState(initialMode);
      applySessionUser(session);
      scheduleExpiryLogout(session.expires_at);
      setHasMemberAccess(false);
      setReady(true);

      fetchWithAuth("/api/member/access")
        .then((response) => response.json().then((payload) => ({ response, payload })))
        .then(async ({ response, payload }) => {
          if (response.status === 401 || response.status === 403) {
            await logoutAuthSession();
            if (payload.code === "SESSION_DISPLACED") {
              router.replace("/login?displaced=1");
            } else {
              router.replace("/login?expired=1");
            }
            return;
          }
          if (!active || !response.ok) return;
          const isMember = Boolean(payload?.data?.is_member);
          setHasMemberAccess(isMember);

          if (nextRole === "MEMBER") {
            setAppModeState("MEMBER");
          } else if (!isMember && initialMode === "MEMBER") {
            // Force back to STAFF if mode is stuck but user is not a member
            setAppMode("STAFF");
            setAppModeState("STAFF");
          }
        })
        .catch(() => setHasMemberAccess(false));
    };

    checkAuth().catch(() => {
      router.replace("/login");
    });

    const unsubscribeAuth = subscribeAuthSession((session) => {
      if (!active || !session?.user) return;
      applySessionUser(session);
    });

    const unsubscribeMode = subscribeAppMode((mode) => {
      if (!active) return;
      setAppModeState(mode);
    });

    return () => {
      active = false;
      if (expiryTimer) clearTimeout(expiryTimer);
      unsubscribeAuth();
      unsubscribeMode();
    };
  }, [pathname, router]);

  const menuItems = useMemo(() => {
    if (appMode === "MEMBER" || roleName === "MEMBER") {
      return MAIN_MENU_MEMBER;
    }

    if (roleName === "CASHIER") {
      return MAIN_MENU_CASHIER;
    }

    const baseMenu = roleName === "STAFF" 
      ? MAIN_MENU_ADMIN_STAFF.filter((item) => item.key !== "logs")
      : MAIN_MENU_ADMIN_STAFF;

    // Further refine the People menu based on role
    return baseMenu.map(item => {
      if (item.key === "people" && item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            if (child === "Users") return roleName === "ADMIN";
            return true;
          })
        };
      }
      return item;
    });
  }, [appMode, roleName]);

  const activeSubmenuKey = useMemo(() => {
    if (pathname === "/(main)/inventory/products") return "inventory:Products";
    if (pathname === "/(main)/inventory/suppliers") return "inventory:Suppliers";
    if (pathname === "/(main)/inventory/batches") return "inventory:Product Batches";
    if (pathname === "/(main)/stock-movements/stock-in") return "stock-movements:Stock In";
    if (pathname === "/(main)/stock-movements/stock-out") return "stock-movements:Stock Out";
    if (pathname === "/(main)/stock-movements/stock-adjustment") return "stock-movements:Stock Adjustment";
    if (pathname === "/(main)/sales/items" || pathname === "/(main)/stock-movements/sales") return "sales:Sales Items";
    if (pathname === "/(main)/sales/costs") return "sales:Sales Cost";
    if (pathname.startsWith("/(main)/users")) return "people:Users";
    if (pathname.startsWith("/(main)/members")) return "people:Members";
    if (pathname.startsWith("/(main)/staffs")) return "people:Staffs";
    return null;
  }, [pathname]);

  if (!ready) return <View style={{ flex: 1 }} />;

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logoutAuthSession();
    router.replace("/login");
  };

  const handleToggleMode = async () => {
    const nextMode = appMode === "STAFF" ? "MEMBER" : "STAFF";
    await setAppMode(nextMode);
    setProfileMenuOpen(false);
    if (nextMode === "MEMBER") {
      router.replace("/(main)/portal/dashboard");
    } else {
      router.replace("/(main)/dashboard");
    }
  };

  const isInventoryPath = pathname.includes("/inventory/");
  const isStockMovementPath = pathname.includes("/stock-movements/");
  const isSalesPath = pathname.includes("/sales/");
  const isPeoplePath = pathname.includes("/users") || pathname.includes("/members") || pathname.includes("/staffs");
  const isMemberDashboard = pathname === "/(main)/portal/dashboard" || (appMode === "MEMBER" && pathname === "/(main)/dashboard");

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", overflow: "hidden", paddingTop: topPad, paddingBottom: bottomPad }}>
      <View style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: [{ scale: appScale }] }}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#f8fafc" }}>
          <AppNavigationSidebar
            logoSource={SIDEBAR_LOGO}
            navItems={menuItems.map((item) => ({
              ...item,
              active:
                (item.key === "dashboard" && pathname === "/(main)/dashboard") ||
                (item.key === "member-dashboard" && isMemberDashboard) ||
                (item.key === "member-transactions" && pathname.startsWith("/(main)/portal/transactions")) ||
                (item.key === "member-shu" && pathname.startsWith("/(main)/portal/shu")) ||
                (item.key === "inventory" && isInventoryPath) ||
                (item.key === "stock-movements" && isStockMovementPath) ||
                (item.key === "sales" && isSalesPath) ||
                (item.key === "people" && isPeoplePath) ||
                (item.key === "reports" && pathname.startsWith("/(main)/reports")) ||
                (item.key === "shu" && pathname.startsWith("/(main)/shu")) ||
                (item.key === "external-financial" && pathname.startsWith("/(main)/external-financial")) ||
                (item.key === "logs" && pathname.startsWith("/(main)/logs")),
            }))}
            expandedMenus={expandedMenus}
            onMenuPress={(item) => {
              if (item.key === "inventory" || item.key === "stock-movements" || item.key === "sales" || item.key === "people") {
                setExpandedMenus((current) => ({ ...current, [item.key]: !current[item.key] }));
                return;
              }
              if (item.key === "dashboard") { router.push("/(main)/dashboard"); return; }
              if (item.key === "member-dashboard") { router.push("/(main)/portal/dashboard"); return; }
              if (item.key === "member-transactions") { router.push("/(main)/portal/transactions"); return; }
              if (item.key === "member-shu") { router.push("/(main)/portal/shu"); return; }
              if (item.key === "reports") { router.push("/(main)/reports"); return; }
              if (item.key === "shu") { router.push("/(main)/shu"); return; }
              if (item.key === "external-financial") { router.push("/(main)/external-financial"); return; }
              if (item.key === "logs") { router.push("/(main)/logs"); }
            }}
            onSubmenuPress={(_, child) => router.push(routeBySubmenu(child) as never)}
            activeSubmenuKey={activeSubmenuKey}
            renderNavIcon={(item) => {
              if (item.icon === "package") return <MaterialCommunityIcons name="package-variant-closed" size={18} color={item.active ? "#2563eb" : "#475569"} />;
              return <Feather name={item.icon as any} size={18} color={item.active ? "#2563eb" : "#475569"} />;
            }}
            renderChevronIcon={(expanded) => <Feather name="chevron-down" size={14} color="#64748b" style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined} />}
            profileName={profileName}
            profileRole={appMode === "MEMBER" ? "MEMBER" : roleName}
            profileImageSource={profileImage ? { uri: profileImage } : PROFILE_PLACEHOLDER}
            profileMenuOpen={profileMenuOpen}
            onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            profileMenuItems={[
              {
                key: "profile",
                label: "Profile",
                icon: "user",
                tone: "default",
                onPress: () => { setProfileMenuOpen(false); router.replace("/(main)/profile"); },
              },
              ...(canAccessCashierModeWithGrade(roleName, staffGradeName) && appMode === "STAFF"
                ? [{ key: "cashier", label: "Enter Cashier Mode", icon: "shopping-cart", tone: "blue" as const, onPress: () => { setProfileMenuOpen(false); router.replace("/(cashier)"); } }]
                : []),
              ...(hasMemberAccess && roleName !== "MEMBER"
                ? [{ key: "mode-toggle", label: appMode === "STAFF" ? "Enter Member Portal" : "Enter Main App", icon: appMode === "STAFF" ? "users" : "monitor", tone: "blue" as const, onPress: handleToggleMode }]
                : []),
              { key: "logout", label: "Logout", icon: "log-out", tone: "danger", onPress: handleLogout },
            ]}
            onLogoutPress={handleLogout}
          />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
          </View>
        </View>
      </View>
    </View>
  );
}
