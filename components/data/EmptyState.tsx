import { StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title?: string;
  description?: string;
};

export default function EmptyState({
  title = "Belum ada data",
  description,
}: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", padding: 32 },
  title: { color: "#061329", fontSize: 16, fontWeight: "800" },
  description: { color: "#52617a", marginTop: 8, textAlign: "center" },
});
