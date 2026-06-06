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
  getAuthSession,
  getRouteByRole,
  isAuthSessionExpired,
  logoutAuthSession,
  normalizeRole,
  subscribeAuthSession,
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
        router.replace(nextRole === "CASHIER" ? "/(main)/inventory/products" : "/(main)/dashboard");
        return;
      }

      if (!active) {
        return;
      }

      applySessionUser(session);
      scheduleExpiryLogout(session.expires_at);
      setHasMemberAccess(false);
      setReady(true);

      fetchWithAuth("/api/member/access")
        .then((response) => response.json().then((payload) => ({ response, payload })))
        .then(({ response, payload }) => {
          if (!active || !response.ok) return;
          setHasMemberAccess(Boolean(payload?.data?.is_member) && nextRole === "MEMBER");
        })
        .catch(() => setHasMemberAccess(false));
    };

    checkAuth().catch(() => {
      router.replace("/login");
    });

    const unsubscribe = subscribeAuthSession((session) => {
      if (!active || !session?.user) return;
      applySessionUser(session);
    });

    return () => {
      active = false;
      if (expiryTimer) clearTimeout(expiryTimer);
      unsubscribe();
    };
  }, [pathname, router]);

  const menuItems = useMemo(() => {
    if (roleName === "CASHIER") {
      return MAIN_MENU_CASHIER;
    }

    if (roleName === "STAFF") {
      return MAIN_MENU_ADMIN_STAFF.filter((item) => item.key !== "logs");
    }

    return MAIN_MENU_ADMIN_STAFF;
  }, [roleName]);

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

  if (!ready) {
    return <View style={{ flex: 1 }} />;
  }

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logoutAuthSession();
    router.replace("/login");
  };

  const isInventoryPath =
    pathname === "/(main)/inventory/products" ||
    pathname === "/(main)/inventory/suppliers" ||
    pathname === "/(main)/inventory/batches";
  const isStockMovementPath =
    pathname === "/(main)/stock-movements/stock-in" ||
    pathname === "/(main)/stock-movements/stock-out" ||
    pathname === "/(main)/stock-movements/stock-adjustment";
  const isSalesPath =
    pathname === "/(main)/sales/items" ||
    pathname === "/(main)/sales/costs" ||
    pathname === "/(main)/stock-movements/sales";
  const isPeoplePath =
    pathname.startsWith("/(main)/users") ||
    pathname.startsWith("/(main)/members") ||
    pathname.startsWith("/(main)/staffs");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        paddingTop: topPad,
        paddingBottom: bottomPad,
      }}
    >
      <View style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: [{ scale: appScale }] }}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#f8fafc" }}>
          <AppNavigationSidebar
            logoSource={SIDEBAR_LOGO}
            navItems={menuItems.map((item) => ({
              ...item,
              active:
                (item.key === "dashboard" && pathname === "/(main)/dashboard") ||
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
                setExpandedMenus((current) => ({
                  ...current,
                  [item.key]: !current[item.key],
                }));
                return;
              }
              if (item.key === "dashboard") {
                router.push("/(main)/dashboard");
                return;
              }
              if (item.key === "reports") {
                router.push("/(main)/reports");
                return;
              }
              if (item.key === "shu") {
                router.push("/(main)/shu");
                return;
              }
              if (item.key === "external-financial") {
                router.push("/(main)/external-financial");
                return;
              }
              if (item.key === "logs") {
                router.push("/(main)/logs");
              }
            }}
            onSubmenuPress={(_, child) => {
              router.push(routeBySubmenu(child) as never);
            }}
            activeSubmenuKey={activeSubmenuKey}
            renderNavIcon={(item) => {
              if (item.icon === "package") {
                return <MaterialCommunityIcons name="package-variant-closed" size={18} color={item.active ? "#2563eb" : "#475569"} />;
              }
              return <Feather name={item.icon as React.ComponentProps<typeof Feather>["name"]} size={18} color={item.active ? "#2563eb" : "#475569"} />;
            }}
            renderChevronIcon={(expanded) => (
              <Feather
                name="chevron-down"
                size={14}
                color="#64748b"
                style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            )}
            profileName={profileName}
            profileRole={roleName}
            profileImageSource={profileImage ? { uri: profileImage } : PROFILE_PLACEHOLDER}
            profileMenuOpen={profileMenuOpen}
            onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            profileMenuItems={[
              {
                key: "profile",
                label: "Profile",
                icon: "user",
                tone: "default",
                onPress: () => {
                  setProfileMenuOpen(false);
                  router.push("/profile");
                },
              },
              ...(canAccessCashierModeWithGrade(roleName, staffGradeName)
                ? [
                    {
                      key: "cashier",
                      label: "Enter Cashier Mode",
                      icon: "shopping-cart",
                      tone: "blue" as const,
                      onPress: () => {
                        setProfileMenuOpen(false);
                        router.replace("/(cashier)");
                      },
                    },
                  ]
                : []),
              ...(hasMemberAccess && roleName === "MEMBER"
                ? [
                    {
                      key: "member",
                      label: "Enter Member Portal",
                      icon: "users",
                      tone: "blue" as const,
                      onPress: () => {
                        setProfileMenuOpen(false);
                        router.replace("/(member)/dashboard");
                      },
                    },
                  ]
                : []),
              {
                key: "logout",
                label: "Logout",
                icon: "log-out",
                tone: "danger",
                onPress: handleLogout,
              },
            ]}
          onLogoutPress={handleLogout}
        />

          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </View>
      </View>
    </View>
  );
}


