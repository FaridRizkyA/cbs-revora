import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The app is designed on a 1366px wide canvas and scaled down to the screen width,
// so web desktop, tablet and phone all show the same layout.
export const APP_BASE_WIDTH = 1366;
// The canvas is never shorter than this, so short landscape screens shrink a bit
// more instead of cutting off fixed panels such as the cashier cart.
const APP_MIN_HEIGHT = 640;

type UseAppScaleOptions = {
  // Reserve the device safe area (status bar, home indicator) around the canvas.
  withSafeAreaPadding?: boolean;
};

export const useAppScale = ({ withSafeAreaPadding = true }: UseAppScaleOptions = {}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isPhoneLandscape = Math.min(width, height) < 768 && width > height;

  // Browsers have no safe area, so the canvas can use the full window.
  const usePadding = withSafeAreaPadding && Platform.OS !== "web";
  const topPad = usePadding ? Math.max(insets.top, 12) + (isPhoneLandscape ? 14 : 0) : 0;
  const bottomPad = usePadding ? Math.max(insets.bottom, 8) : 0;
  const usableHeight = Math.max(height - topPad - bottomPad, 320);

  const scale = Math.min(1, width / APP_BASE_WIDTH, usableHeight / APP_MIN_HEIGHT);

  return {
    scale,
    canvasWidth: APP_BASE_WIDTH,
    // Fill the whole height instead of a fixed 16:9 canvas, which left empty bands on 16:10 tablets.
    canvasHeight: usableHeight / scale,
    topPad,
    bottomPad,
  };
};
