import { ReactNode } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

type MemberLookupModalProps = {
  visible: boolean;
  children?: ReactNode;
};

export default function MemberLookupModal({ visible, children }: MemberLookupModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>Cari Member</Text>
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
  modal: { width: "100%", maxWidth: 540, backgroundColor: "#ffffff", borderRadius: 8, padding: 20 },
  title: { color: "#061329", fontSize: 18, fontWeight: "900", marginBottom: 16 },
});
