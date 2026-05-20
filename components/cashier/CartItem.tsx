import { Pressable, StyleSheet, Text, View } from "react-native";

type CartItemProps = {
  name: string;
  price: string;
  quantity: number;
  onDecrease?: () => void;
  onIncrease?: () => void;
};

export default function CartItem({
  name,
  price,
  quantity,
  onDecrease,
  onIncrease,
}: CartItemProps) {
  return (
    <View style={styles.item}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.price}>{price}</Text>
      </View>
      <View style={styles.quantity}>
        <Pressable style={styles.button} onPress={onDecrease}>
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyText}>{quantity}</Text>
        <Pressable style={styles.button} onPress={onIncrease}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#eef2f7",
    borderBottomWidth: 1,
    gap: 12,
    paddingVertical: 12,
  },
  info: { flex: 1 },
  name: { color: "#061329", fontSize: 15, fontWeight: "800" },
  price: { color: "#2563eb", fontWeight: "800", marginTop: 5 },
  quantity: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonText: { color: "#061329", fontSize: 18, fontWeight: "800" },
  qtyText: { width: 20, color: "#061329", fontWeight: "800", textAlign: "center" },
});
