import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppNavigationSidebar, { NavigationItem } from "../../components/navigation/AppNavigationSidebar";
import {
  canAccessMainApp,
  clearAuthSession,
  canCashierAccessMainPath,
  getAuthSession,
  getRouteByRole,
  normalizeRole,
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
  { key: "reports", label: "Reports", icon: "file-text" },
  { key: "members", label: "Members", icon: "users" },
  { key: "shu", label: "SHU", icon: "pie-chart" },
  { key: "income", label: "External Income", icon: "dollar-sign" },
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
];

const routeBySubmenu = (child: string) => {
  if (child === "Products") return "/(main)/inventory/products";
  if (child === "Suppliers") return "/(main)/inventory/suppliers";
  if (child === "Product Batches") return "/(main)/inventory/batches";
  if (child === "Stock In") return "/(main)/stock-movements/stock-in";
  if (child === "Stock Out") return "/(main)/stock-movements/stock-out";
  if (child === "Stock Adjustment") return "/(main)/stock-movements/stock-adjustment";
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    inventory: true,
    "stock-movements": true,
  });

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const session = await getAuthSession();
      const nextRole = normalizeRole(session?.user?.role_name);

      if (!session?.token || !nextRole) {
        router.replace("/login");
        return;
      }

      if (!canAccessMainApp(nextRole)) {
        router.replace(getRouteByRole(nextRole));
        return;
      }

      if (nextRole === "CASHIER" && !canCashierAccessMainPath(pathname)) {
        router.replace("/(main)/dashboard");
        return;
      }

      if (!active) {
        return;
      }

      setRoleName(nextRole);
      setProfileName(session?.user?.full_name || "User");
      setReady(true);
    };

    checkAuth().catch(() => {
      router.replace("/login");
    });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  const menuItems = useMemo(
    () => (roleName === "CASHIER" ? MAIN_MENU_CASHIER : MAIN_MENU_ADMIN_STAFF),
    [roleName]
  );

  const activeSubmenuKey = useMemo(() => {
    if (pathname === "/(main)/inventory/products") return "inventory:Products";
    if (pathname === "/(main)/inventory/suppliers") return "inventory:Suppliers";
    if (pathname === "/(main)/inventory/batches") return "inventory:Product Batches";
    if (pathname === "/(main)/stock-movements/stock-in") return "stock-movements:Stock In";
    if (pathname === "/(main)/stock-movements/stock-out") return "stock-movements:Stock Out";
    if (pathname === "/(main)/stock-movements/stock-adjustment") return "stock-movements:Stock Adjustment";
    if (pathname === "/(main)/inventory/stock-in") return "stock-movements:Stock In";
    if (pathname === "/(main)/inventory/stock-out") return "stock-movements:Stock Out";
    if (pathname === "/(main)/inventory/stock-adjustment") return "stock-movements:Stock Adjustment";
    return null;
  }, [pathname]);

  if (!ready) {
    return <View style={{ flex: 1 }} />;
  }

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await clearAuthSession();
    router.replace("/login");
  };

  const isInventoryPath =
    pathname === "/(main)/inventory/products" ||
    pathname === "/(main)/inventory/suppliers" ||
    pathname === "/(main)/inventory/batches";
  const isStockMovementPath =
    pathname === "/(main)/stock-movements/stock-in" ||
    pathname === "/(main)/stock-movements/stock-out" ||
    pathname === "/(main)/stock-movements/stock-adjustment" ||
    pathname === "/(main)/inventory/stock-in" ||
    pathname === "/(main)/inventory/stock-out" ||
    pathname === "/(main)/inventory/stock-adjustment";

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
                (item.key === "reports" && pathname.startsWith("/(main)/reports")) ||
                (item.key === "members" && pathname.startsWith("/(main)/members")) ||
                (item.key === "shu" && pathname.startsWith("/(main)/shu")) ||
                (item.key === "income" && pathname.startsWith("/(main)/incomes")),
            }))}
            expandedMenus={expandedMenus}
            onMenuPress={(item) => {
              if (item.key === "inventory" || item.key === "stock-movements") {
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
              if (item.key === "members") {
                router.push("/(main)/members");
                return;
              }
              if (item.key === "shu") {
                router.push("/(main)/shu");
                return;
              }
              if (item.key === "income") {
                router.push("/(main)/incomes");
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
            profileImageSource={PROFILE_PLACEHOLDER}
            profileMenuOpen={profileMenuOpen}
            onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            onLogoutPress={handleLogout}
            footerAction={
              <Pressable
                style={{
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: "#1d4ed8",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={() => router.replace("/(cashier)")}
              >
                <Feather name="shopping-cart" size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 13 }}>Enter Cashier Mode</Text>
              </Pressable>
            }
          />

          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </View>
      </View>
    </View>
  );
}


