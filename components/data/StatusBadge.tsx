import { StyleSheet, Text, View } from "react-native";

type StatusBadgeProps = {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
};

export default function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, tone === "neutral" && styles.neutralText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  success: { backgroundColor: "#dcfce7" },
  warning: { backgroundColor: "#fef3c7" },
  danger: { backgroundColor: "#fee2e2" },
  neutral: { backgroundColor: "#eef3f9" },
  text: { color: "#166534", fontSize: 12, fontWeight: "800" },
  neutralText: { color: "#26354c" },
});
