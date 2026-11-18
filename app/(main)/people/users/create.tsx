import { StyleSheet, Text, View } from "react-native";

export default function CreateUserScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create User</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
