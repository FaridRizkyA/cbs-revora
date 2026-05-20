import { StyleSheet, Text, View } from "react-native";

export default function UsersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Users</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
