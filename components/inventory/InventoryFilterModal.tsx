import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

type FilterOption = {
  label: string;
  value: string;
};

type InventoryFilterModalProps = {
  title: string;
  visible: boolean;
  selectedValue: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

export default function InventoryFilterModal({
  title,
  visible,
  selectedValue,
  options,
  onSelect,
  onClose,
}: InventoryFilterModalProps) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              maxWidth: isPhone ? Math.max(shortSide * 0.9, 300) : 360,
              maxHeight: isPhone ? height * 0.76 : height * 0.84,
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <View style={styles.options}>
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.option, selectedValue === opt.value && styles.optionActive]}
                onPress={() => onSelect(opt.value)}
              >
                <Text style={[styles.optionText, selectedValue === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  title: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  options: {
    gap: 8,
  },
  option: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  optionActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  optionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  optionTextActive: {
    color: "#1d4ed8",
  },
  closeButton: {
    marginTop: 2,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
