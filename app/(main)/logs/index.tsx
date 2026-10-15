import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { formatActivityTypeLabel } from "../../../utils/activityLog";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import { getAuthSession, normalizeRole } from "../../../utils/authSession";
import { printReportHtml } from "../../../utils/printUtils";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { buildReportTablePrintHtml, downloadReportTableExcel, ReportTableColumn } from "../../../components/reports/shared/ReportPrintTemplate";
import { formatDisplayDateTime, toLocalDateInput } from "../../../utils/dateFormat";

type PeriodFilter = "LAST_7_DAYS" | "LAST_30_DAYS" | "ALL_TIME";

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: "LAST_7_DAYS", label: "Last 7 Days" },
  { key: "LAST_30_DAYS", label: "Last 30 Days" },
  { key: "ALL_TIME", label: "All Time" },
];

// Upper bound per request; the API caps it at the same value.
const LOG_FETCH_LIMIT = 1000;

const buildPeriodQuery = (period: PeriodFilter) => {
  if (period === "ALL_TIME") return "";
  const start = new Date();
  start.setDate(start.getDate() - (period === "LAST_7_DAYS" ? 6 : 29));
  return `&start_date=${toLocalDateInput(start)}&end_date=${toLocalDateInput()}`;
};

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

const formatDateTime = (value?: string | null) => formatDisplayDateTime(value);

export default function LogsScreen() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("LAST_30_DAYS");
  const [search, setSearch] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [roleName, setRoleName] = useState("ADMIN");

  useEffect(() => {
    getAuthSession()
      .then((session) => setRoleName(normalizeRole(session?.user?.role_name) || "ADMIN"))
      .catch(() => setRoleName("ADMIN"));
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.actor_name,
        row.actor_email,
        row.activity_type,
        formatActivityTypeLabel(row.activity_type),
        row.target_label,
        row.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [rows, search]);

  const getReportData = () => ({
    title: "Activity Logs Report",
    subtitle: "System audit trail",
    reportKey: "activity-logs",
    generatedAt: new Date(),
    generatedBy: roleName,
    meta: [
      { label: "Period", value: PERIOD_OPTIONS.find((item) => item.key === period)?.label || "-" },
      { label: "Total Logs", value: filteredRows.length },
    ],
    columns: [
      { key: "date", title: "Date", width: "15%", getValue: (row: ActivityLogRow) => formatDateTime(row.activity_date) },
      { key: "actor", title: "Actor", width: "17%", getValue: (row: ActivityLogRow) => row.actor_name || row.actor_email || "-" },
      { key: "activity", title: "Activity", width: "17%", getValue: (row: ActivityLogRow) => formatActivityTypeLabel(row.activity_type) },
      { key: "target", title: "Target", width: "19%", getValue: (row: ActivityLogRow) => row.target_label || row.record_id || "-" },
      { key: "description", title: "Description", width: "32%", getValue: (row: ActivityLogRow) => row.description || "-" },
    ] as ReportTableColumn<ActivityLogRow>[],
    rows: filteredRows,
  });

  const handlePrint = async () => {
    try {
      const html = buildReportTablePrintHtml(getReportData());
      await printReportHtml(html, { tableName: "tbl_activity_logs", description: "Printed activity logs." });
    } catch {
      setErrorMessage("Failed to print logs.");
    }
  };

  const handleExportExcel = async () => {
    try {
      await downloadReportTableExcel(getReportData());
    } catch {
      setErrorMessage("Failed to export Excel.");
    }
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: "Activity Logs Report",
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: "Activity Logs Report",
        subtitle: "System audit trail",
        generated_by: roleName,
        print_html: buildReportTablePrintHtml(getReportData()),
        columns: getReportData().columns.map(c => ({ key: c.key, title: c.title, align: c.align })),
        rows: filteredRows.map((row, index) => {
          const rowData: any = {};
          getReportData().columns.forEach(c => { rowData[c.key] = c.getValue(row, index); });
          return rowData;
        }),
      };
      const response = await fetchWithAuth("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });
      if (!response.ok) throw new Error("Failed to send email.");
      setEmailModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send email.");
    }
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuth(`/api/activity-logs?limit=${LOG_FETCH_LIMIT}${buildPeriodQuery(period)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Failed to fetch activity logs.");
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch activity logs.");
    } finally {
      setLoading(false);
    }
  }, [period]);

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
        
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable style={styles.refreshButton} onPress={loadLogs} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
          </Pressable>
          <ExportDropdownMenu onExportPdf={handlePrint} onExportExcel={handleExportExcel} onSendEmail={() => setEmailModalOpen(true)} />
        </View>

      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.filterCard}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search actor, activity, target, or description"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
        <View style={styles.periodChipRow}>
          {PERIOD_OPTIONS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.periodChip, period === item.key && styles.periodChipActive]}
              onPress={() => setPeriod(item.key)}
            >
              <Text style={[styles.periodChipText, period === item.key && styles.periodChipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {rows.length >= LOG_FETCH_LIMIT ? (
          <Text style={styles.limitText}>
            Showing the latest {LOG_FETCH_LIMIT} logs for this period. Choose a shorter period to see older entries.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <InventoryDataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.id_activity_log}
          emptyText="No activity logs found."
          initialPageSize={10}
          pageSizeOptions={[10, 25, 50]}
          minWidth={980}
        />
      </View>
    
      <SendEmailModal visible={emailModalOpen} onClose={() => setEmailModalOpen(false)} onSend={handleSendEmailReport} reportTitle="Activity Logs" />
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
  filterCard: { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", padding: 12, gap: 10 },
  searchInput: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", paddingHorizontal: 12, color: "#0f172a" },
  periodChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodChip: { minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  periodChipActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  periodChipText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  periodChipTextActive: { color: "#1d4ed8" },
  limitText: { color: "#64748b", fontSize: 12 },
  refreshButton: { height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  rowCell: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
});
