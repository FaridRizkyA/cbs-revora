import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type InventoryPageHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export default function InventoryPageHeader({ title, subtitle, action }: InventoryPageHeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 30, color: "#0f2852", fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13 },
  actionWrap: { alignItems: "flex-end" },
});
