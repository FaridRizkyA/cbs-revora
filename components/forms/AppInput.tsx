import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

type AppInputProps = TextInputProps & {
  label?: string;
};

export default function AppInput({ label, style, ...props }: AppInputProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#61708a" style={[styles.input, style]} {...props} />
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
