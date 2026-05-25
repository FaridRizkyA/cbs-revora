import { Image } from "expo-image";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AppSidebar from "../layout/AppSidebar";

export type NavigationItem = {
  key: string;
  label: string;
  icon: string;
  active?: boolean;
  children?: string[];
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
  footerAction,
}: AppNavigationSidebarProps) {
  return (
    <AppSidebar>
      <View style={styles.brandRow}>
        <Image source={logoSource} style={styles.sidebarLogo} contentFit="contain" />
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
                      <Text
                        style={[
                          styles.submenuText,
                          activeSubmenuKey === `${item.key}:${child}` && styles.submenuTextActive,
                        ]}
                      >
                        {child}
                      </Text>
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
        <View style={styles.avatar}>
          <Image source={profileImageSource} style={styles.avatarImage} contentFit="cover" />
        </View>
        <View>
          <Text style={styles.profileName}>{profileName}</Text>
          <Text style={styles.profileRole}>{profileRole}</Text>
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
    width: "100%",
    height: 56,
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
    height: 66,
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
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
});
