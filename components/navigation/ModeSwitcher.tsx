import { Pressable, StyleSheet, Text, View } from "react-native";

type ModeSwitcherProps = {
  value: string;
  modes: string[];
  onChange: (value: string) => void;
};

export default function ModeSwitcher({ value, modes, onChange }: ModeSwitcherProps) {
  return (
    <View style={styles.switcher}>
      {modes.map((mode) => {
        const active = mode === value;

        return (
          <Pressable
            key={mode}
            style={[styles.mode, active && styles.activeMode]}
            onPress={() => onChange(mode)}
          >
            <Text style={[styles.text, active && styles.activeText]}>{mode}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: "row",
    backgroundColor: "#eef3f9",
    borderRadius: 8,
    padding: 4,
  },
  mode: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  activeMode: { backgroundColor: "#ffffff" },
  text: { color: "#52617a", fontWeight: "700" },
  activeText: { color: "#061329" },
});
