import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type ProfileCardProps = {
  name: string;
  role?: string;
  children?: ReactNode;
};

export default function ProfileCard({ name, role, children }: ProfileCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      {role ? <Text style={styles.role}>{role}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  name: { color: "#061329", fontSize: 18, fontWeight: "900" },
  role: { color: "#52617a", marginTop: 4, marginBottom: 12 },
});
