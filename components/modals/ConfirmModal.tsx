import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={onCancel}>
              <Text style={styles.secondaryText}>Batal</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={onConfirm}>
              <Text style={styles.primaryText}>Konfirmasi</Text>
            </Pressable>
          </View>
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
  modal: { width: "100%", maxWidth: 420, backgroundColor: "#ffffff", borderRadius: 8, padding: 20 },
  title: { color: "#061329", fontSize: 18, fontWeight: "900" },
  message: { color: "#52617a", marginTop: 8 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  secondary: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  primary: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: "#26354c", fontWeight: "800" },
  primaryText: { color: "#ffffff", fontWeight: "800" },
});
