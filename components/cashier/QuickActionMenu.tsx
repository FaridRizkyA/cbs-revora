import { Pressable, StyleSheet, Text, View } from "react-native";

type QuickAction = {
  label: string;
  onPress?: () => void;
};

type QuickActionMenuProps = { actions: QuickAction[] };

export default function QuickActionMenu({ actions }: QuickActionMenuProps) {
  return (
    <View style={styles.menu}>
      {actions.map((action) => (
        <Pressable key={action.label} style={styles.button} onPress={action.onPress}>
          <Text style={styles.text}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    backgroundColor: "#eef3f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: { color: "#26354c", fontWeight: "700" },
});
