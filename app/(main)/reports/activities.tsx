import { StyleSheet, Text, View } from "react-native";

export default function ActivitiesReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activities Report</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
