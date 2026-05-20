import { StyleSheet, Text, TextInput, View } from "react-native";

type DatePickerFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
};

export default function DatePickerField({ label, value, onChangeText }: DatePickerFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#61708a"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: "#53657f", fontSize: 12, fontWeight: "800" },
  input: {
    height: 44,
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    color: "#061329",
    paddingHorizontal: 12,
  },
});
