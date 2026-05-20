import { Pressable, StyleSheet, Text, View } from "react-native";

type QuantityInputProps = {
  value: number;
  onDecrease?: () => void;
  onIncrease?: () => void;
};

export default function QuantityInput({ value, onDecrease, onIncrease }: QuantityInputProps) {
  return (
    <View style={styles.control}>
      <Pressable style={styles.button} onPress={onDecrease}>
        <Text style={styles.buttonText}>-</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={styles.button} onPress={onIncrease}>
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  value: { width: 24, color: "#061329", fontWeight: "800", textAlign: "center" },
});
