import { StyleSheet, Text, View } from "react-native";

export default function DailyReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Report</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
