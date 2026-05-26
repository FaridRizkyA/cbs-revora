import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

type PrimaryActionButtonProps = {
  label: string;
  onPress: () => void;
  iconName?: ComponentProps<typeof Feather>["name"];
  fullWidth?: boolean;
  variant?: "primary" | "secondary";
};

export default function PrimaryActionButton({
  label,
  onPress,
  iconName = "plus",
  fullWidth = false,
  variant = "primary",
}: PrimaryActionButtonProps) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === "primary" ? styles.primary : styles.secondary,
        fullWidth && styles.fullWidth,
      ]}
      onPress={onPress}
    >
      <Feather
        name={iconName}
        size={16}
        color={variant === "primary" ? "#ffffff" : "#1d4ed8"}
      />
      <Text style={[styles.text, variant === "primary" ? styles.primaryText : styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    minWidth: 150,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: "#1d4ed8",
  },
  secondary: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
  primaryText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: "#1d4ed8",
  },
});
