import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

type AppTextareaProps = TextInputProps & {
  label?: string;
};

export default function AppTextarea({ label, style, ...props }: AppTextareaProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline
        placeholderTextColor="#61708a"
        style={[styles.textarea, style]}
        textAlignVertical="top"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: "#53657f", fontSize: 12, fontWeight: "800" },
  textarea: {
    minHeight: 96,
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    color: "#061329",
    padding: 12,
  },
});
