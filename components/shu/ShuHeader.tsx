import { Text, View } from "react-native";
import { styles } from "./styles";

export function ShuHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.pageTitle}>SHU (Patronage Refund)</Text>
      <Text style={styles.subTitle}>Track yearly SHU results, review live distribution estimates, and finalize cooperative patronage refunds.</Text>
    </View>
  );
}
