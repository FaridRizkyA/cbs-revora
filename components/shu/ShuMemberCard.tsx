import { useMemo } from "react";
import { Text, View } from "react-native";
import InventoryDataTable, { InventoryDataTableColumn } from "../inventory/InventoryDataTable";
import { formatPercent, formatRupiah } from "./formatters";
import { styles } from "./styles";
import { MemberDistribution } from "./types";

type Props = {
  rows: MemberDistribution[];
};

export function ShuMemberCard({ rows }: Props) {
  const activeRows = useMemo(() => rows.filter((row) => row.is_active !== "N"), [rows]);

  const totals = useMemo(
    () =>
      activeRows.reduce(
        (acc, row) => {
          acc.memberCount += 1;
          acc.totalSpending += row.member_total_spending || 0;
          acc.totalShu += row.shu_amount || 0;
          return acc;
        },
        { memberCount: 0, totalSpending: 0, totalShu: 0 }
      ),
    [activeRows]
  );

  const columns = useMemo<InventoryDataTableColumn<MemberDistribution>[]>(
    () => [
      {
        key: "member",
        title: "Member",
        weight: 24,
        sortable: true,
        sortValue: (row) => row.full_name || row.member_code || row.id_member,
        render: (row) => <Text style={styles.rowCell}>{row.full_name || row.member_code || row.id_member}</Text>,
      },
      {
        key: "spending",
        title: "Spending",
        weight: 16,
        align: "right",
        sortable: true,
        sortValue: (row) => Number(row.member_total_spending || 0),
        render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.member_total_spending)}</Text>,
      },
      {
        key: "ratio",
        title: "Ratio",
        weight: 10,
        align: "center",
        sortable: true,
        sortValue: (row) => Number(row.spending_percentage || 0),
        render: (row) => <Text style={styles.rowCell}>{formatPercent(row.spending_percentage)}</Text>,
      },
      {
        key: "sales_shu",
        title: "Sales SHU",
        weight: 14,
        align: "right",
        sortable: true,
        sortValue: (row) => Number(row.sales_shu_amount || 0),
        render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.sales_shu_amount)}</Text>,
      },
      {
        key: "business_shu",
        title: "Business SHU",
        weight: 14,
        align: "right",
        sortable: true,
        sortValue: (row) => Number(row.business_shu_amount || 0),
        render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.business_shu_amount)}</Text>,
      },
      {
        key: "shu_total",
        title: "Total SHU",
        weight: 12,
        align: "right",
        sortable: true,
        sortValue: (row) => Number(row.shu_amount || 0),
        render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.shu_amount)}</Text>,
      },
    ],
    []
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Member Distribution</Text>
      {activeRows.length === 0 ? (
        <Text style={styles.metaText}>No member distribution available yet.</Text>
      ) : (
        <>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Member Count</Text>
            <Text style={styles.summaryValue}>{totals.memberCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Member Spending</Text>
            <Text style={styles.summaryValue}>{formatRupiah(totals.totalSpending)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Member SHU (Patronage Refund)</Text>
            <Text style={styles.summaryValue}>{formatRupiah(totals.totalShu)}</Text>
          </View>
          <InventoryDataTable
            columns={columns}
            rows={activeRows}
            rowKey={(row) => row.id_member}
            emptyText="No member distribution available yet."
            initialPageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      )}
    </View>
  );
}
