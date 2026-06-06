import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ResponsiveModal from "../common/ResponsiveModal";

type ConfirmModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "success" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type ResultModalProps = {
  visible: boolean;
  status: "success" | "error";
  title: string;
  message: string;
  closeLabel?: string;
  onClose: () => void;
};

export function InventoryConfirmModal({
  visible,
  title = "Please Confirm",
  message,
  confirmLabel = "Yes, Continue",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmStyle =
    tone === "danger" ? styles.submitBtnDanger : tone === "success" ? styles.submitBtnSuccess : styles.submitBtn;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      maxWidthDesktop={420}
      maxWidthPhoneRatio={0.96}
      maxHeightDesktopRatio={0.84}
      maxHeightPhoneRatio={0.9}
      cardStyle={styles.confirmModalCard}
    >
      <Text style={styles.modalTitle}>{title}</Text>
      <Text style={styles.confirmText}>{message}</Text>
      <View style={styles.confirmActionRow}>
        <Pressable style={[styles.cancelBtn, loading && styles.disabledBtn]} onPress={onCancel} disabled={loading}>
          <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable style={[confirmStyle, loading && styles.disabledBtn]} onPress={onConfirm} disabled={loading}>
          <Text style={styles.submitBtnText}>{loading ? "Processing..." : confirmLabel}</Text>
        </Pressable>
      </View>
    </ResponsiveModal>
  );
}

export function InventoryResultModal({
  visible,
  status,
  title,
  message,
  closeLabel = "OK",
  onClose,
}: ResultModalProps) {
  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      maxWidthDesktop={380}
      maxWidthPhoneRatio={0.94}
      maxHeightDesktopRatio={0.82}
      maxHeightPhoneRatio={0.9}
      cardStyle={styles.resultModalCard}
    >
      <Feather
        name={status === "success" ? "check-circle" : "x-circle"}
        size={42}
        color={status === "success" ? "#16a34a" : "#dc2626"}
      />
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultMessage}>{message}</Text>
      <Pressable style={styles.resultCloseBtn} onPress={onClose}>
        <Text style={styles.resultCloseBtnText}>{closeLabel}</Text>
      </Pressable>
    </ResponsiveModal>
  );
}

const styles = StyleSheet.create({
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  confirmModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  confirmText: { color: "#334155", fontSize: 13, lineHeight: 20 },
  confirmActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnSuccess: { minHeight: 36, borderRadius: 10, backgroundColor: "#16a34a", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnDanger: { minHeight: 36, borderRadius: 10, backgroundColor: "#dc2626", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  disabledBtn: { opacity: 0.6 },
  resultModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10 },
  resultTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  resultMessage: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  resultCloseBtn: { marginTop: 4, width: "100%", height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  resultCloseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
