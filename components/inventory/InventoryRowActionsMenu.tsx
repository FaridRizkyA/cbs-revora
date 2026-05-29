import { ReactNode, useEffect, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type InventoryRowActionsMenuProps = {
  open: boolean;
  onToggle: () => void;
  direction?: "down" | "up";
  children: ReactNode;
};

export default function InventoryRowActionsMenu({ open, onToggle, direction = "down", children }: InventoryRowActionsMenuProps) {
  const anchorRef = useRef<View | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [menuHeight, setMenuHeight] = useState(160);

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
  const topUp = anchor ? Math.max(8, anchor.y - menuHeight - 6) : 8;

  return (
    <View ref={anchorRef} style={styles.actionDropdownWrap}>
      <Pressable style={styles.actionMenuButton} onPress={onToggle}>
        <Text style={styles.actionMenuButtonText}>Actions</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={onToggle}>
        <View style={styles.portalRoot} pointerEvents="box-none">
          <Pressable style={styles.portalBackdrop} onPress={onToggle} />
          {anchor ? (
            <View
              style={[
                styles.actionMenu,
                {
                  right,
                  top: direction === "up" ? topUp : topDown,
                },
              ]}
              onLayout={(event) => {
                const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                if (nextHeight > 0 && nextHeight !== menuHeight) setMenuHeight(nextHeight);
              }}
            >
              {children}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actionDropdownWrap: { position: "relative", alignItems: "flex-end", zIndex: 1200 },
  actionMenuButton: { minHeight: 28, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionMenuButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  portalRoot: { flex: 1 },
  portalBackdrop: { ...StyleSheet.absoluteFillObject },
  actionMenu: { position: "absolute", minWidth: 132, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#dbe3ee", padding: 6, gap: 6, zIndex: 9999, elevation: 12 },
});
