import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

type IconFilterButtonProps = {
  onPress: () => void;
};

export default function IconFilterButton({ onPress }: IconFilterButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Feather name="sliders" size={16} color="#1d4ed8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
});
