import { useEffect, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type ExportDropdownMenuProps = {
  onExportPdf: () => void;
  onExportExcel?: () => void;
  onSendEmail: () => void;
  variant?: "table" | "detail";
};

export default function ExportDropdownMenu({ onExportPdf, onExportExcel, onSendEmail, variant = "table" }: ExportDropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<View | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [menuHeight, setMenuHeight] = useState(130);

  const toggleOpen = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  const screen = Dimensions.get("window");
  const right = anchor ? Math.max(8, screen.width - (anchor.x + anchor.width)) : 8;
  const topDown = anchor ? Math.min(screen.height - menuHeight - 8, anchor.y + anchor.height + 6) : 8;

  return (
    <View ref={anchorRef} style={styles.actionDropdownWrap}>
      <Pressable
        style={styles.exportIconButton}
        onPress={toggleOpen}
        accessibilityLabel="Export options"
      >
        <MaterialCommunityIcons name="file-upload-outline" size={20} color="#1d4ed8" />
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={toggleOpen}>
        <View style={styles.portalRoot} pointerEvents="box-none">
          <Pressable style={styles.portalBackdrop} onPress={toggleOpen} />
          {anchor ? (
            <View
              style={[
                styles.actionMenu,
                { right, top: topDown },
              ]}
              onLayout={(event) => {
                const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                if (nextHeight > 0 && nextHeight !== menuHeight) setMenuHeight(nextHeight);
              }}
            >
              <Pressable
                style={[styles.menuItem, styles.menuItemPdf]}
                onPress={() => {
                  toggleOpen();
                  onExportPdf();
                }}
              >
                <MaterialCommunityIcons name="file-pdf-box" size={18} color="#b91c1c" />
                <Text style={[styles.menuItemText, styles.menuItemTextPdf]}>Export as PDF</Text>
              </Pressable>
              
              {variant === "table" ? (
                <Pressable
                  style={[styles.menuItem, styles.menuItemExcel]}
                  onPress={() => {
                    toggleOpen();
                    if (onExportExcel) onExportExcel();
                  }}
                >
                  <MaterialCommunityIcons name="file-excel-box" size={18} color="#15803d" />
                  <Text style={[styles.menuItemText, styles.menuItemTextExcel]}>Export as Excel</Text>
                </Pressable>
              ) : null}

              <View style={styles.divider} />

              <Pressable
                style={[styles.menuItem, styles.menuItemEmail]}
                onPress={() => {
                  toggleOpen();
                  onSendEmail();
                }}
              >
                <MaterialCommunityIcons name="email-fast-outline" size={18} color="#0f766e" />
                <Text style={[styles.menuItemText, styles.menuItemTextEmail]}>Send via Email</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actionDropdownWrap: { position: "relative", alignItems: "flex-end", zIndex: 1200 },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  portalRoot: { flex: 1 },
  portalBackdrop: { ...StyleSheet.absoluteFillObject },
  actionMenu: { position: "absolute", minWidth: 170, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", padding: 6, gap: 4, zIndex: 9999, elevation: 12, shadowColor: "#0f172a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1, backgroundColor: "#f8fafc" },
  menuItemText: { fontSize: 13, fontWeight: "700" },
  menuItemPdf: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  menuItemTextPdf: { color: "#b91c1c" },
  menuItemExcel: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  menuItemTextExcel: { color: "#15803d" },
  menuItemEmail: { borderColor: "#99f6e4", backgroundColor: "#f0fdfa" },
  menuItemTextEmail: { color: "#0f766e" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginHorizontal: 4, marginVertical: 2 },
});
