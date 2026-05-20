import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type CashierHeaderProps = {
  title?: string;
  children?: ReactNode;
};

export default function CashierHeader({ title = "Produk", children }: CashierHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  title: { color: "#061329", fontSize: 21, fontWeight: "800" },
});
