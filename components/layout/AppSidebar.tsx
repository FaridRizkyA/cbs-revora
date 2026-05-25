import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type AppSidebarProps = { children?: ReactNode };

export default function AppSidebar({ children }: AppSidebarProps) {
  return <View style={styles.sidebar}>{children}</View>;
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: "#ffffff",
    borderRightColor: "#dde5f0",
    borderRightWidth: 1,
  },
});
