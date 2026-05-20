import { Pressable, StyleSheet, Text, View } from "react-native";

type SelectOption = {
  label: string;
  value: string;
};

type AppSelectProps = {
  label?: string;
  value?: string;
  options?: SelectOption[];
  onChange?: (value: string) => void;
};

export default function AppSelect({ label, value, options = [], onChange }: AppSelectProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              style={[styles.option, active && styles.activeOption]}
              onPress={() => onChange?.(option.value)}
            >
              <Text style={[styles.optionText, active && styles.activeOptionText]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {!options.length ? <Text style={styles.placeholder}>{selected?.label ?? "Pilih data"}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: "#53657f", fontSize: 12, fontWeight: "800" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activeOption: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  optionText: { color: "#26354c", fontWeight: "700" },
  activeOptionText: { color: "#ffffff" },
  placeholder: { color: "#61708a" },
});
