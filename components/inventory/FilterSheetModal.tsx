import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ResponsiveModal from "../common/ResponsiveModal";

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
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      maxWidthDesktop={420}
      maxWidthPhoneRatio={0.96}
      maxHeightDesktopRatio={0.84}
      maxHeightPhoneRatio={0.9}
      cardStyle={styles.card}
    >
      <Text style={styles.title}>{title}</Text>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
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
    </ResponsiveModal>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
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
    paddingBottom: 6,
  },
  contentScroll: {
    maxHeight: "78%",
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
