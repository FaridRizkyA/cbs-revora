import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type AppHeaderProps = {
  title: string;
  actions?: ReactNode;
};

export default function AppHeader({ title, actions }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#061329",
    fontSize: 24,
    fontWeight: "800",
  },
});
