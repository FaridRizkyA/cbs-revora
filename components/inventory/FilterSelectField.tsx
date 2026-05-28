import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

type Option = {
  label: string;
  value: string;
};

type FilterSelectFieldProps = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export default function FilterSelectField({
  label,
  value,
  options,
  onChange,
}: FilterSelectFieldProps) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((opt) => opt.value === value);
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Text style={styles.valueText}>{selected?.label || "Select option"}</Text>
        <Feather name="chevron-down" size={14} color="#64748b" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.modalCard,
              {
                maxWidth: isPhone ? Math.max(shortSide * 0.92, 300) : 520,
                maxHeight: isPhone ? height * 0.78 : height * 0.8,
              },
            ]}
          >
            <View style={styles.searchWrap}>
              <Feather name="search" size={14} color="#64748b" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${label.toLowerCase()}...`}
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                autoFocus
              />
            </View>
            <ScrollView style={styles.dropdownScroll} contentContainerStyle={styles.dropdown}>
              {filteredOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.item, opt.value === value && styles.itemActive]}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.itemText, opt.value === value && styles.itemTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              {filteredOptions.length === 0 ? (
                <Text style={styles.emptyText}>No options found.</Text>
              ) : null}
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700" },
  field: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  valueText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    padding: 12,
    gap: 10,
  },
  searchWrap: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: "#334155", fontSize: 12, paddingVertical: 0 },
  dropdownScroll: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#ffffff" },
  dropdown: {
    overflow: "hidden",
  },
  item: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  itemActive: { backgroundColor: "#eff6ff" },
  itemText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  itemTextActive: { color: "#1d4ed8", fontWeight: "700" },
  emptyText: { color: "#64748b", fontSize: 12, padding: 12 },
  closeButton: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
});
