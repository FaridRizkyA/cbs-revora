import { ReactNode, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type SortDirection = "asc" | "desc";

export type InventoryDataTableColumn<T> = {
  key: string;
  title: string;
  width?: string | number;
  weight?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T, meta: { rowIndex: number; totalRows: number }) => ReactNode;
};

type InventoryDataTableProps<T> = {
  columns: InventoryDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyText: string;
  isRowActive?: (row: T) => boolean;
  minWidth?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  enablePagination?: boolean;
  renderFooter?: () => ReactNode;
  footerValues?: ReactNode[];
};
type SortRule = { key: string; direction: SortDirection };

function compareValues(a: string | number, b: string | number, direction: SortDirection) {
  const order = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * order;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * order;
}

export default function InventoryDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyText,
  isRowActive,
  minWidth = 0,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  enablePagination = true,
  renderFooter,
  footerValues,
}: InventoryDataTableProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sortedRows = useMemo(() => {
    if (sortRules.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const rule of sortRules) {
        const targetCol = columns.find((c) => c.key === rule.key);
        if (!targetCol?.sortable || !targetCol.sortValue) continue;
        const result = compareValues(targetCol.sortValue(a), targetCol.sortValue(b), rule.direction);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [columns, rows, sortRules]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    if (!enablePagination) return sortedRows;
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [enablePagination, pageSize, safePage, sortedRows]);

  const onSortPress = (column: InventoryDataTableColumn<T>) => {
    if (!column.sortable || !column.sortValue) return;
    setPage(1);
    setSortRules((prev) => {
      const existingIndex = prev.findIndex((rule) => rule.key === column.key);
      if (existingIndex < 0) {
        return [...prev, { key: column.key, direction: "asc" }];
      }
      const next = [...prev];
      if (next[existingIndex].direction === "asc") {
        next[existingIndex] = { key: column.key, direction: "desc" };
        return next;
      }
      next.splice(existingIndex, 1);
      return next;
    });
  };

  const startIndex = sortedRows.length === 0 ? 0 : enablePagination ? (safePage - 1) * pageSize + 1 : 1;
  const endIndex = enablePagination ? Math.min(sortedRows.length, safePage * pageSize) : sortedRows.length;
  const resolvedWidth = Math.max(minWidth || 0, containerWidth || 0);
  const totalWeight = useMemo(() => {
    const sum = columns.reduce((acc, column) => acc + Math.max(0, Number(column.weight || 0)), 0);
    return sum > 0 ? sum : columns.length || 1;
  }, [columns]);

  const resolveColumnWidth = (column: InventoryDataTableColumn<T>) => {
    if (column.width !== undefined) return column.width;
    const weight = Math.max(0, Number(column.weight || 1));
    return `${(weight / totalWeight) * 100}%`;
  };

  return (
    <View
      style={styles.wrapper}
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== containerWidth) setContainerWidth(nextWidth);
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollViewport}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.tableInner, resolvedWidth ? { width: resolvedWidth } : null]}>
          <View style={styles.tableHeader}>
            {columns.map((column) => {
              const ruleIndex = sortRules.findIndex((rule) => rule.key === column.key);
              const isSorted = ruleIndex >= 0;
              const direction = isSorted ? sortRules[ruleIndex].direction : null;
              const icon = !isSorted ? "<>" : direction === "asc" ? "^" : "v";
              const orderLabel = isSorted && sortRules.length > 1 ? `${ruleIndex + 1}` : "";
              const columnIndex = columns.findIndex((item) => item.key === column.key);
              const isFirstColumn = columnIndex === 0;
              const isLastColumn = columnIndex === columns.length - 1;
              return (
                <Pressable
                  key={column.key}
                  style={[
                    styles.headerCell,
                    { width: resolveColumnWidth(column) },
                    isFirstColumn && styles.headerCellFirst,
                    isLastColumn && styles.headerCellLast,
                    column.align === "center" && styles.centerBox,
                    column.align === "right" && styles.rightBox,
                  ]}
                  onPress={() => onSortPress(column)}
                  disabled={!column.sortable}
                >
                  <Text style={[styles.headCellText, column.align === "center" && styles.center, column.align === "right" && styles.right]}>
                    {column.title}
                    {column.sortable ? ` ${icon}${orderLabel}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {pagedRows.map((row, rowIndex) => (
            <View key={rowKey(row, rowIndex)} style={[styles.tableRow, isRowActive?.(row) ? styles.tableRowActive : null]}>
              {columns.map((column) => (
                <View
                  key={column.key}
                  style={[
                    styles.bodyCell,
                    { width: resolveColumnWidth(column) },
                    column.align === "center" && styles.centerBox,
                    column.align === "right" && styles.rightBox,
                  ]}
                >
                  <View
                    style={[
                      styles.cellContent,
                      column.align === "center" && styles.centerBox,
                      column.align === "right" && styles.rightBox,
                    ]}
                  >
                    {column.render(row, { rowIndex, totalRows: pagedRows.length })}
                  </View>
                </View>
              ))}
            </View>
          ))}

          {pagedRows.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
          {footerValues ? (
            <View style={[styles.tableRow, { backgroundColor: "#f8fafc", borderTopWidth: 2, borderTopColor: "#e2e8f0" }]}>
              {columns.map((column, index) => (
                <View
                  key={column.key}
                  style={[
                    styles.bodyCell,
                    { width: resolveColumnWidth(column) },
                    column.align === "center" && styles.centerBox,
                    column.align === "right" && styles.rightBox,
                  ]}
                >
                  <View
                    style={[
                      styles.cellContent,
                      column.align === "center" && styles.centerBox,
                      column.align === "right" && styles.rightBox,
                    ]}
                  >
                    {footerValues[index] !== undefined ? footerValues[index] : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {renderFooter ? renderFooter() : null}
        </View>
      </ScrollView>

      {enablePagination ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{`Showing ${startIndex}-${endIndex} of ${sortedRows.length}`}</Text>
          <View style={styles.footerActions}>
            <View style={styles.pageSizeRow}>
              {pageSizeOptions.map((size) => (
                <Pressable
                  key={String(size)}
                  style={[styles.pageSizeBtn, pageSize === size && styles.pageSizeBtnActive]}
                  onPress={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.pageSizeText, pageSize === size && styles.pageSizeTextActive]}>{size}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.pagerBtn} onPress={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1}>
              <Text style={styles.pagerText}>Prev</Text>
            </Pressable>
            <Text style={styles.footerText}>{`${safePage}/${totalPages}`}</Text>
            <Pressable style={styles.pagerBtn} onPress={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages}>
              <Text style={styles.pagerText}>Next</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{`Total ${sortedRows.length} row(s)`}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "visible" },
  scrollViewport: { overflow: "visible" },
  scrollContent: { overflow: "visible" },
  tableInner: { width: "100%" },
  tableHeader: { backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 1, borderBottomColor: "#dbe3ee", paddingVertical: 10 },
  tableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7", paddingVertical: 4, position: "relative" },
  tableRowActive: { zIndex: 5000, elevation: 20 },
  headerCell: { paddingHorizontal: 10, justifyContent: "center" },
  headerCellFirst: { borderTopLeftRadius: 12 },
  headerCellLast: { borderTopRightRadius: 12 },
  bodyCell: { paddingHorizontal: 10, justifyContent: "center" },
  headCellText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  cellContent: { justifyContent: "center", paddingVertical: 8 },
  centerBox: { alignItems: "center", justifyContent: "center" },
  rightBox: { alignItems: "flex-end", justifyContent: "center" },
  emptyText: { color: "#64748b", fontSize: 12, padding: 12 },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  footer: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  footerText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageSizeRow: { flexDirection: "row", gap: 6 },
  pageSizeBtn: { borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6 },
  pageSizeBtnActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  pageSizeText: { color: "#334155", fontSize: 11, fontWeight: "700" },
  pageSizeTextActive: { color: "#1d4ed8" },
  pagerBtn: { borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  pagerText: { color: "#334155", fontSize: 11, fontWeight: "700" },
});
