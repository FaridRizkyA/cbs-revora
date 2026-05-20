import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type DataTableProps = {
  headers?: string[];
  children?: ReactNode;
};

export default function DataTable({ headers = [], children }: DataTableProps) {
  return (
    <ScrollView horizontal>
      <View style={styles.table}>
        {headers.length ? (
          <View style={styles.headerRow}>
            {headers.map((header) => (
              <Text key={header} style={styles.headerCell}>
                {header}
              </Text>
            ))}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: {
    minWidth: 720,
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", backgroundColor: "#f8fafc" },
  headerCell: {
    flex: 1,
    color: "#53657f",
    fontSize: 12,
    fontWeight: "800",
    padding: 12,
  },
});
