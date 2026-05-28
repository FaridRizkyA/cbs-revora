import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ResponsiveModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  cardStyle?: ViewStyle | ViewStyle[];
  maxWidthDesktop?: number;
  maxWidthPhoneRatio?: number;
  maxHeightDesktopRatio?: number;
  maxHeightPhoneRatio?: number;
  closeOnBackdrop?: boolean;
};

export default function ResponsiveModal({
  visible,
  onClose,
  children,
  cardStyle,
  maxWidthDesktop = 980,
  maxWidthPhoneRatio = 0.94,
  maxHeightDesktopRatio = 0.9,
  maxHeightPhoneRatio = 0.82,
  closeOnBackdrop = true,
}: ResponsiveModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;
  const usableHeight = Math.max(height - Math.max(insets.top, 8) - Math.max(insets.bottom, 8), 320);
  const maxWidth = isPhone ? Math.min(width * maxWidthPhoneRatio, maxWidthDesktop) : maxWidthDesktop;
  const maxHeight = (isPhone ? maxHeightPhoneRatio : maxHeightDesktopRatio) * usableHeight;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeOnBackdrop ? onClose : undefined} />
        <View style={[styles.cardBase, { maxWidth, maxHeight }, cardStyle]}>{children}</View>
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
  cardBase: {
    width: "100%",
  },
});
