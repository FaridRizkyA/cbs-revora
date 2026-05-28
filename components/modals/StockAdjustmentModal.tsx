import { ReactNode } from "react";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";

type StockAdjustmentModalProps = {
  visible: boolean;
  children?: ReactNode;
};

export default function StockAdjustmentModal({ visible, children }: StockAdjustmentModalProps) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modal,
            {
              maxWidth: isPhone ? Math.max(shortSide * 0.94, 320) : 520,
              maxHeight: isPhone ? height * 0.82 : height * 0.88,
            },
          ]}
        >
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
  modal: { width: "100%", backgroundColor: "#ffffff", borderRadius: 8, padding: 20 },
  title: { color: "#061329", fontSize: 18, fontWeight: "900", marginBottom: 16 },
});
