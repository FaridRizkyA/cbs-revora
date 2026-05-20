import { StyleSheet, Text, View } from "react-native";

export default function SavingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Savings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
