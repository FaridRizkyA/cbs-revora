import { Stack } from "expo-router";
import { LogBox, Text } from "react-native";

// Suppress known library-level warnings that don't affect functionality on Web
LogBox.ignoreLogs([
  "Unknown event handler property `onPressIn`",
  "Text.defaultProps"
]);

// Enable text selection globally for all texts in the app
const TextWithDefaultProps = Text as any;
if (!TextWithDefaultProps.defaultProps) {
  TextWithDefaultProps.defaultProps = {};
}
TextWithDefaultProps.defaultProps.selectable = true;

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="(cashier)" />
    </Stack>
  );
}
