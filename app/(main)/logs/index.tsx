import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { API_BASE_URL } from "../../../utils/api";
import { formatActivityTypeLabel } from "../../../utils/activityLog";

type ActivityLogRow = {
  id_activity_log: string;
  actor_name?: string | null;
  actor_email?: string | null;
  activity_type: string;
  table_name?: string | null;
  record_id?: string | null;
  target_label?: string | null;
  description?: string | null;
  ip_address?: string | null;
  activity_date: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export default function LogsScreen() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/activity-logs?limit=200`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Failed to fetch activity logs.");
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch activity logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns = useMemo<InventoryDataTableColumn<ActivityLogRow>[]>(
    () => [
      {
        key: "date",
        title: "Date",
        weight: 16,
        sortable: true,
        sortValue: (row) => new Date(row.activity_date).getTime(),
        render: (row) => <Text style={styles.rowCell}>{formatDateTime(row.activity_date)}</Text>,
      },
      {
        key: "actor",
        title: "Actor",
        weight: 18,
        sortable: true,
        sortValue: (row) => row.actor_name || row.actor_email || "",
        render: (row) => <Text style={styles.rowCell}>{row.actor_name || row.actor_email || "-"}</Text>,
      },
      {
        key: "activity",
        title: "Activity",
        weight: 18,
        sortable: true,
        sortValue: (row) => row.activity_type,
        render: (row) => <Text style={styles.rowCell}>{formatActivityTypeLabel(row.activity_type)}</Text>,
      },
      {
        key: "target",
        title: "Target",
        weight: 20,
        sortable: true,
        sortValue: (row) => row.target_label || row.record_id || "",
        render: (row) => <Text style={styles.rowCell}>{row.target_label || row.record_id || "-"}</Text>,
      },
      {
        key: "description",
        title: "Description",
        weight: 34,
        sortable: true,
        sortValue: (row) => row.description || "",
        render: (row) => <Text style={styles.rowCell}>{row.description || "-"}</Text>,
      },
    ],
    []
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Logs</Text>
          <Text style={styles.subtitle}>Audit trail for authentication, data changes, print/export, and sensitive actions.</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={loadLogs} disabled={loading}>
          <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.card}>
        <InventoryDataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id_activity_log}
          emptyText="No activity logs found."
          initialPageSize={10}
          pageSizeOptions={[10, 25, 50]}
          minWidth={980}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 24, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  title: { color: "#0f172a", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 4 },
  card: { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", padding: 14 },
  refreshButton: { height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  rowCell: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
});
