import { StyleSheet, Text } from "react-native";

// Red asterisk placed inside a field label Text, so it inherits the label's size.
export default function RequiredMark() {
  return <Text style={styles.mark}> *</Text>;
}

const styles = StyleSheet.create({
  mark: { color: "#dc2626" },
});
