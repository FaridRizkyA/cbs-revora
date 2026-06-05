import { useMemo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { CSSProperties } from "react";

type DatePickerFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export default function DatePickerField({
  label,
  value,
  placeholder = "Select date",
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
}: DatePickerFieldProps) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(parseDate(value));

  const displayValue = useMemo(() => (value ? value : placeholder), [placeholder, value]);
  const webInputStyle: CSSProperties = useMemo(
    () => ({
      width: "100%",
      minHeight: 38,
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      backgroundColor: disabled ? "#f1f5f9" : "#ffffff",
      padding: "0 12px",
      color: disabled ? "#94a3b8" : "#0f172a",
      fontSize: 13,
      outline: "none",
      boxSizing: "border-box",
      opacity: disabled ? 0.8 : 1,
    }),
    [disabled]
  );

  const openPicker = () => {
    if (disabled) return;
    setDraftDate(parseDate(value));
    setOpen(true);
  };

  const applyDate = () => {
    onChange(formatDate(draftDate));
    setOpen(false);
  };

  return (
    <View style={[styles.wrap, disabled && styles.wrapDisabled]}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "web" ? (
        <input
          type="date"
          value={value || ""}
          min={minimumDate ? formatDate(minimumDate) : undefined}
          max={maximumDate ? formatDate(maximumDate) : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webInputStyle}
          disabled={disabled}
        />
      ) : (
      <Pressable style={[styles.field, disabled && styles.fieldDisabled]} onPress={openPicker}>
        <Text style={[styles.fieldText, !value ? styles.placeholderText : null, disabled && styles.fieldTextDisabled]}>{displayValue}</Text>
      </Pressable>
      )}

      <Modal visible={Platform.OS !== "web" && open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.card,
              {
                maxWidth: isPhone ? Math.max(shortSide * 0.9, 280) : 360,
                maxHeight: isPhone ? height * 0.72 : height * 0.82,
              },
            ]}
          >
            <Text style={styles.title}>{label}</Text>
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setDraftDate(selectedDate);
                }}
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.applyBtn]} onPress={applyDate}>
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            </View>
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
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  fieldText: { color: "#0f172a", fontSize: 13 },
  fieldTextDisabled: { color: "#94a3b8" },
  placeholderText: { color: "#94a3b8" },
  wrapDisabled: { opacity: 0.8 },
  fieldDisabled: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12, gap: 10 },
  title: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  pickerWrap: { alignItems: "center" },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff" },
  cancelText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  applyBtn: { backgroundColor: "#1d4ed8" },
  applyText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
});
