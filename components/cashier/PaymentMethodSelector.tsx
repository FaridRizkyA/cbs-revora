import { Pressable, StyleSheet, Text, View } from "react-native";

type PaymentMethodSelectorProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export default function PaymentMethodSelector({
  value,
  options,
  onChange,
}: PaymentMethodSelectorProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option === value;

        return (
          <Pressable
            key={option}
            style={[styles.button, active && styles.activeButton]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.text, active && styles.activeText]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  button: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
  },
  activeButton: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  text: { color: "#26354c", fontWeight: "700" },
  activeText: { color: "#ffffff" },
});
