import { StyleSheet, Text, View } from "react-native";

export default function CashierStockInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cashier Stock In</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
