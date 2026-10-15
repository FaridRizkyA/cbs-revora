import { Text, TextInput, View } from "react-native";
import RequiredMark from "../forms/RequiredMark";
import { styles } from "./peopleScreen.styles";

export function Input({
  label,
  value,
  onChangeText,
  secure,
  wrapStyle,
  editable = true,
  keyboardType = "default",
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  secure?: boolean;
  wrapStyle?: object;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}) {
  return (
    <View style={[styles.fieldWrap, wrapStyle]}>
      <Text style={styles.label}>{label}{required ? <RequiredMark /> : null}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        style={[styles.input, !editable && { backgroundColor: "#f1f5f9", color: "#64748b" }]}
        editable={editable}
      />
    </View>
  );
}

export function Meta({
  label,
  value,
  textarea,
  cardStyle,
}: {
  label: string;
  value?: string | number | null;
  textarea?: boolean;
  cardStyle?: object;
}) {
  return (
    <View style={[styles.metaItem, textarea && styles.metaItemTextarea, cardStyle]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "-"}</Text>
    </View>
  );
}
