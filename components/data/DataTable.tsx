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
            {headers.map((header, index) => (
              <Text
                key={header}
                style={[
                  styles.headerCell,
                  index === 0 && styles.headerCellFirst,
                  index === headers.length - 1 && styles.headerCellLast,
                ]}
              >
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
  headerRow: { flexDirection: "row", backgroundColor: "#f8fafc", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  headerCell: {
    flex: 1,
    color: "#53657f",
    fontSize: 12,
    fontWeight: "800",
    padding: 12,
  },
  headerCellFirst: { borderTopLeftRadius: 8 },
  headerCellLast: { borderTopRightRadius: 8 },
});
