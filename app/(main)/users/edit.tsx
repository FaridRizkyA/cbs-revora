import { StyleSheet, Text, View } from "react-native";

export default function EditUserScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit User</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
});
