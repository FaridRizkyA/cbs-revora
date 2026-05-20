import { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

type ProductGridProps = { children?: ReactNode };

export default function ProductGrid({ children }: ProductGridProps) {
  return <ScrollView contentContainerStyle={styles.grid}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    paddingBottom: 24,
  },
});
