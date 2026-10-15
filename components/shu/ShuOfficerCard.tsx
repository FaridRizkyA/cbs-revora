import { useMemo } from "react";
import { Text, View } from "react-native";
import InventoryDataTable, { InventoryDataTableColumn } from "../inventory/InventoryDataTable";
import { formatRupiah } from "./formatters";
import { styles } from "./styles";
import { OfficerDistribution } from "./types";

type Props = {
  rows: OfficerDistribution[];
};

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

export function ShuOfficerCard({ rows }: Props) {
  const columns = useMemo<InventoryDataTableColumn<OfficerDistribution>[]>(
    () => [
      {
        key: "role",
        title: "Role",
        weight: 40,
        sortable: true,
        sortValue: (row) => row.officer_role_code || "",
        render: (row) => <Text style={styles.rowCell}>{displayText(row.officer_role_code)}</Text>,
      },
      {
        key: "name",
        title: "Name",
        weight: 30,
        sortable: true,
        sortValue: (row) => row.full_name || "",
        render: (row) => <Text style={styles.rowCell}>{row.full_name || "-"}</Text>,
      },
      {
        key: "amount",
        title: "SHU Amount",
        weight: 30,
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
      <Text style={styles.cardTitle}>Officer Distribution</Text>
      {rows.length === 0 ? (
        <Text style={styles.metaText}>No officer distribution available yet.</Text>
      ) : (
        <InventoryDataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => `${row.id_staff}-${row.officer_role_code}`}
          emptyText="No officer distribution available yet."
          enablePagination={false}
          footerValues={[
            <Text key="footer-0" style={[styles.rowCell, { fontWeight: "700" }]}>Total</Text>,
            <Text key="footer-1" style={styles.rowCell} />,
            <Text key="footer-2" style={[styles.rowCell, { fontWeight: "700" }]}>{formatRupiah(rows.reduce((sum, r) => sum + (r.shu_amount || 0), 0))}</Text>,
          ]}
        />
      )}
    </View>
  );
}
