import { StyleSheet, Text, View } from "react-native";

export default function IncomesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incomes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
