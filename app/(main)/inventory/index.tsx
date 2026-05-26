import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { canManageInventoryMaster, getAuthSession, normalizeRole } from "../../../utils/authSession";

export default function InventoryScreen() {
  const [roleName, setRoleName] = useState("CASHIER");

  useEffect(() => {
    getAuthSession()
      .then((session) => setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER"))
      .catch(() => setRoleName("CASHIER"));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory</Text>
      <Text style={styles.subtitle}>
        {canManageInventoryMaster(roleName)
          ? "Staff/Admin: view, add, edit, soft delete (inactive)"
          : "Cashier: view only"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 12 },
});
