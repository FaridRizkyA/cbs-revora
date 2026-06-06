import { Image } from "expo-image";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AppSidebar from "../layout/AppSidebar";

export type NavigationItem = {
  key: string;
  label: string;
  icon: string;
  active?: boolean;
  children?: string[];
};

export type ProfileDropdownItem = {
  key: string;
  label: string;
  icon: string;
  tone?: "default" | "blue" | "danger";
  onPress: () => void;
};

type AppNavigationSidebarProps = {
  logoSource: number;
  navItems: NavigationItem[];
  expandedMenus?: Record<string, boolean>;
  onMenuPress?: (item: NavigationItem) => void;
  onSubmenuPress?: (item: NavigationItem, child: string) => void;
  activeSubmenuKey?: string | null;
  renderNavIcon: (item: NavigationItem) => ReactNode;
  renderChevronIcon: (expanded: boolean) => ReactNode;
  profileName: string;
  profileRole: string;
  profileImageSource: number | { uri: string };
  profileMenuOpen?: boolean;
  onToggleProfileMenu?: () => void;
  onProfilePress?: () => void;
  onLogoutPress?: () => void;
  profileMenuItems?: ProfileDropdownItem[];
  footerAction?: ReactNode;
};

export default function AppNavigationSidebar({
  logoSource,
  navItems,
  expandedMenus = {},
  onMenuPress,
  onSubmenuPress,
  activeSubmenuKey = null,
  renderNavIcon,
  renderChevronIcon,
  profileName,
  profileRole,
  profileImageSource,
  profileMenuOpen = false,
  onToggleProfileMenu,
  onProfilePress,
  onLogoutPress,
  profileMenuItems,
  footerAction,
}: AppNavigationSidebarProps) {
  return (
    <AppSidebar>
      <View style={styles.brandRow}>
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
          <Image source={require("../../assets/images/ui/logo_koperasi_cbs.png")} style={{ width: 44, height: 44 }} contentFit="contain" />
          <Image source={logoSource} style={styles.sidebarLogo} contentFit="contain" />
        </View>
      </View>

      <ScrollView style={styles.navList} contentContainerStyle={styles.navListContent}>
        {navItems.map((item) => {
          const expanded = Boolean(expandedMenus[item.key]);
          return (
            <View key={item.key}>
              <Pressable
                style={[styles.navItem, item.active && styles.navItemActive]}
                onPress={() => onMenuPress?.(item)}
              >
                {renderNavIcon(item)}
                <Text style={[styles.navText, item.active && styles.navTextActive]}>{item.label}</Text>
                {item.children?.length ? renderChevronIcon(expanded) : null}
              </Pressable>

              {item.children?.length && expanded ? (
                <View style={styles.submenuList}>
                  {item.children.map((child) => (
                    <Pressable
                      key={`${item.key}-${child}`}
                      style={styles.submenuItem}
                      onPress={() => onSubmenuPress?.(item, child)}
                    >
                      <View pointerEvents="none">
                        <Text
                          style={[
                            styles.submenuText,
                            activeSubmenuKey === `${item.key}:${child}` && styles.submenuTextActive,
                          ]}
                        >
                          {child}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {footerAction ? <View style={styles.footerActionWrap}>{footerAction}</View> : null}

      <View style={styles.profileWrap}>
        <View style={styles.profileMenuWrap}>
          <Pressable style={styles.profileTrigger} onPress={onToggleProfileMenu}>
            <View style={styles.avatar}>
              <Image source={profileImageSource} style={styles.avatarImage} contentFit="cover" />
            </View>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileRole}>{profileRole}</Text>
            </View>
            <Feather name="chevron-up" size={14} color="#64748b" style={profileMenuOpen ? undefined : { transform: [{ rotate: "180deg" }] }} />
          </Pressable>
          {profileMenuOpen ? (
            <View style={styles.profileDropdown}>
              {(profileMenuItems && profileMenuItems.length > 0
                ? profileMenuItems
                : [
                    { key: "profile", label: "Profile", icon: "user", tone: "default" as const, onPress: onProfilePress || (() => undefined) },
                    { key: "logout", label: "Logout", icon: "log-out", tone: "danger" as const, onPress: onLogoutPress || (() => undefined) },
                  ]
              ).map((item) => (
                <Pressable key={item.key} style={styles.dropdownItem} onPress={item.onPress}>
                  <Feather
                    name={item.icon as keyof typeof Feather.glyphMap}
                    size={14}
                    color={item.tone === "danger" ? "#dc2626" : item.tone === "blue" ? "#2563eb" : "#334155"}
                  />
                  <Text
                    style={[
                      styles.dropdownItemTextNormal,
                      item.tone === "danger" && styles.dropdownItemTextDanger,
                      item.tone === "blue" && styles.dropdownItemTextBlue,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </AppSidebar>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    height: 84,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sidebarLogo: {
    flex: 1,
    height: 44,
  },
  navList: {
    flex: 1,
  },
  navListContent: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 2,
  },
  navItem: {
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  navItemInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navItemActive: {
    backgroundColor: "#eff6ff",
  },
  navText: {
    flex: 1,
    color: "#475569",
    fontSize: 15,
    fontWeight: "500",
  },
  navTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  submenuList: {
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 38,
    gap: 2,
  },
  submenuItem: {
    minHeight: 30,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  submenuText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "500",
  },
  submenuTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  footerActionWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  profileWrap: {
    minHeight: 66,
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 40,
  },
  profileMenuWrap: {
    position: "relative",
  },
  profileTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileTextWrap: {
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  profileName: {
    color: "#1e293b",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },
  profileRole: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  profileDropdown: {
    position: "absolute",
    left: 0,
    bottom: 50,
    width: "90%",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    padding: 6,
    zIndex: 120,
  },
  dropdownItem: {
    height: 34,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  dropdownItemInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dropdownItemText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
  dropdownItemTextNormal: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  dropdownItemTextBlue: {
    color: "#2563eb",
  },
  dropdownItemTextDanger: {
    color: "#dc2626",
  },
});

