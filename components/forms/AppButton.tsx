import { Pressable, PressableProps, StyleSheet, Text } from "react-native";

type AppButtonProps = PressableProps & {
  title: string;
  variant?: "primary" | "secondary" | "danger";
};

export default function AppButton({
  title,
  variant = "primary",
  style,
  disabled,
  ...props
}: AppButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      style={(state) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.text, variant !== "primary" && styles.darkText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: "#2563eb" },
  secondary: { backgroundColor: "#eef3f9" },
  danger: { backgroundColor: "#fee2e2" },
  disabled: { opacity: 0.55 },
  text: { color: "#ffffff", fontWeight: "800" },
  darkText: { color: "#26354c" },
});
