import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type CartPanelProps = {
  title?: string;
  children?: ReactNode;
};

export default function CartPanel({ title = "Keranjang", children }: CartPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 350,
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  title: { color: "#061329", fontSize: 22, fontWeight: "900", marginBottom: 20 },
});
