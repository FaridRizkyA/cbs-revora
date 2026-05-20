import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type InfoCardProps = {
  title: string;
  children?: ReactNode;
};

export default function InfoCard({ title, children }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  title: { color: "#061329", fontSize: 16, fontWeight: "800", marginBottom: 12 },
});
