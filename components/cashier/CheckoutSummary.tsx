import { Pressable, StyleSheet, Text, View } from "react-native";

type CheckoutSummaryProps = {
  subtotal: string;
  total: string;
  loading?: boolean;
  disabled?: boolean;
  onCheckout?: () => void;
};

export default function CheckoutSummary({
  subtotal,
  total,
  loading,
  disabled,
  onCheckout,
}: CheckoutSummaryProps) {
  return (
    <View style={styles.summary}>
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>{subtotal}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{total}</Text>
      </View>
      <Pressable
        disabled={disabled || loading}
        style={[styles.button, (disabled || loading) && styles.disabled]}
        onPress={onCheckout}
      >
        <Text style={styles.buttonText}>{loading ? "Memproses..." : "Bayar"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { borderTopColor: "#dbe4ef", borderTopWidth: 1, paddingTop: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#dbe4ef",
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  label: { color: "#061329", fontSize: 16 },
  value: { color: "#061329", fontSize: 16 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  totalLabel: { color: "#061329", fontSize: 25, fontWeight: "900" },
  totalValue: { color: "#061329", fontSize: 25, fontWeight: "900" },
  button: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
});
