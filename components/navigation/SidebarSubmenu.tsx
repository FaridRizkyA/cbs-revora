import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type SidebarSubmenuProps = {
  title: string;
  children?: ReactNode;
};

export default function SidebarSubmenu({ title, children }: SidebarSubmenuProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.items}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  title: {
    color: "#53657f",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  items: { gap: 4 },
});
