import { StyleSheet, Text, View } from "react-native";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
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
  label: { color: "#53657f", fontSize: 12, fontWeight: "800" },
  value: { color: "#061329", fontSize: 24, fontWeight: "900", marginTop: 8 },
  helper: { color: "#52617a", marginTop: 6 },
});
