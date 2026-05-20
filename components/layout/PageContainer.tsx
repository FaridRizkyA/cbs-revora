import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type PageContainerProps = { children?: ReactNode };

export default function PageContainer({ children }: PageContainerProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
    padding: 24,
  },
});
