import { ReactNode } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

type StockAdjustmentModalProps = {
  visible: boolean;
  children?: ReactNode;
};

export default function StockAdjustmentModal({ visible, children }: StockAdjustmentModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>Penyesuaian Stok</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    padding: 24,
  },
  modal: { width: "100%", maxWidth: 520, backgroundColor: "#ffffff", borderRadius: 8, padding: 20 },
  title: { color: "#061329", fontSize: 18, fontWeight: "900", marginBottom: 16 },
});
