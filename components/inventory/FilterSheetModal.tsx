import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type FilterSheetModalProps = {
  title: string;
  visible: boolean;
  children: ReactNode;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

export default function FilterSheetModal({
  title,
  visible,
  children,
  onApply,
  onReset,
  onClose,
}: FilterSheetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.content}>{children}</View>
          <View style={styles.actions}>
            <Pressable style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={onApply}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
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
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  title: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  content: {
    gap: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  resetButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  applyButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  closeButton: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
});
