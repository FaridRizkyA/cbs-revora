import { Stack } from "expo-router";
import { LogBox } from "react-native";

// Suppress known library-level warnings that don't affect functionality on Web
LogBox.ignoreLogs([
  "Unknown event handler property `onPressIn`",
]);

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="(cashier)" />
      <Stack.Screen name="(member)" />
    </Stack>
  );
}
