import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppNavigationSidebar, { NavigationItem, ProfileDropdownItem } from "../navigation/AppNavigationSidebar";
import { canAccessMainApp, clearAuthSession, getAuthSession, normalizeRole } from "../../utils/authSession";

const SIDEBAR_LOGO = require("../../assets/images/ui/logo_horizontal.png");
const PROFILE_PLACEHOLDER = require("../../assets/images/placeholders/default-profile.png");

export type MemberNavKey = "dashboard" | "profile" | "transactions" | "shu";

type MemberShellProps = {
  title: string;
  subtitle?: string;
  active: MemberNavKey;
  onNavigate: (key: MemberNavKey) => void;
  children: ReactNode;
  rightAction?: ReactNode;
};

const NAV_ITEMS: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "profile", label: "Profile", icon: "user" },
  { key: "transactions", label: "Transactions", icon: "shopping-bag" },
  { key: "shu", label: "SHU", icon: "pie-chart" },
];

export default function MemberShell({ title, subtitle, active, onNavigate, children, rightAction }: MemberShellProps) {
  const router = useRouter();
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState("Member");
  const [profileRole, setProfileRole] = useState("MEMBER");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    let activeSession = true;
    getAuthSession()
      .then((session) => {
        if (!activeSession) return;
        setProfileName(session?.user?.full_name || "Member");
        setProfileRole(normalizeRole(session?.user?.role_name) || "MEMBER");
        setProfileImage(session?.user?.profile_image || null);
      })
      .catch(() => {
        if (activeSession) {
          setProfileName("Member");
          setProfileRole("MEMBER");
          setProfileImage(null);
        }
      });

    return () => {
      activeSession = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setProfileMenuOpen(false);
    await clearAuthSession();
    router.replace("/login");
  }, [router]);

  const profileMenuItems = useMemo(() => {
    const items: ProfileDropdownItem[] = [
      {
        key: "profile",
        label: "Profile",
        icon: "user",
        tone: "default" as const,
        onPress: () => {
          setProfileMenuOpen(false);
          router.push("/(member)/profile");
        },
      },
    ];

    if (canAccessMainApp(profileRole)) {
      items.push({
        key: "main-app",
        label: "Enter Main App",
        icon: "arrow-right-circle",
        tone: "blue" as const,
        onPress: () => {
          setProfileMenuOpen(false);
          router.replace("/(main)/dashboard");
        },
      });
    }

    items.push({
      key: "logout",
      label: "Logout",
      icon: "log-out",
      tone: "danger" as const,
      onPress: handleLogout,
    });

    return items;
  }, [handleLogout, profileRole, router]);

  return (
    <View
      style={[
        styles.viewportShell,
        {
          paddingTop: topPad,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View
        style={[
          styles.scaledCanvas,
          {
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: [{ scale: appScale }],
          },
        ]}
      >
        <View style={styles.layout}>
          <AppNavigationSidebar
            logoSource={SIDEBAR_LOGO}
            navItems={NAV_ITEMS.map((item) => ({
              ...item,
              active: item.key === active,
            }))}
            onMenuPress={(item) => onNavigate(item.key as MemberNavKey)}
            renderNavIcon={(item) => (
              <Feather name={item.icon as React.ComponentProps<typeof Feather>["name"]} size={18} color={item.active ? "#2563eb" : "#475569"} />
            )}
            renderChevronIcon={() => null}
            profileName={profileName}
            profileRole={profileRole}
            profileImageSource={profileImage ? { uri: profileImage } : PROFILE_PLACEHOLDER}
            profileMenuOpen={profileMenuOpen}
            onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            profileMenuItems={profileMenuItems}
          />

          <View style={styles.contentArea}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={[
                styles.contentScrollInner,
                isPhoneLandscape ? styles.contentScrollInnerLandscape : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                {rightAction ? <View style={styles.headerAction}>{rightAction}</View> : null}
              </View>

              <View style={styles.body}>{children}</View>
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportShell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scaledCanvas: {
    overflow: "hidden",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f8fafc",
  },
  contentArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    padding: 16,
    gap: 14,
    minHeight: "100%",
  },
  contentScrollInnerLandscape: {
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  headerAction: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  body: {
    gap: 14,
  },
});
