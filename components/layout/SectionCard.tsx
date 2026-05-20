import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type SectionCardProps = { children?: ReactNode };

export default function SectionCard({ children }: SectionCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
});
