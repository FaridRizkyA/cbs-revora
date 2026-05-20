import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

type MemberOption = {
  id: string | null;
  label: string;
};

type MemberSelectorProps = {
  value: string | null;
  options: MemberOption[];
  onChange: (value: string | null) => void;
};

export default function MemberSelector({ value, options, onChange }: MemberSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const active = option.id === value;

        return (
          <Pressable
            key={option.id ?? "general"}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChange(option.id)}
          >
            <Text style={[styles.text, active && styles.activeText]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    maxWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
  },
  activeChip: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  text: { color: "#26354c", fontWeight: "700" },
  activeText: { color: "#ffffff" },
});
