import { StyleSheet, Text, TextInput, View } from "react-native";

type BarcodeInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
};

export default function BarcodeInput({ value, onChangeText, onSubmit }: BarcodeInputProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>#</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="Scan barcode..."
        placeholderTextColor="#61708a"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 38,
    width: 200,
    alignItems: "center",
    backgroundColor: "#eef3f9",
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  icon: { color: "#53657f", fontSize: 19, marginRight: 8 },
  input: { flex: 1, color: "#061329", fontSize: 15 },
});
