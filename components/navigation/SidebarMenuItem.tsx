import { Pressable, StyleSheet, Text } from "react-native";

type SidebarMenuItemProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export default function SidebarMenuItem({ label, active, onPress }: SidebarMenuItemProps) {
  return (
    <Pressable style={[styles.item, active && styles.active]} onPress={onPress}>
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    height: 49,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  active: { backgroundColor: "#eaf2ff" },
  text: { color: "#26354c", fontSize: 16, fontWeight: "600" },
  activeText: { color: "#2563eb" },
});
