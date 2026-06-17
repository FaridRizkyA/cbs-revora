import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { formatActivityTypeLabel } from "../../../utils/activityLog";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import { getAuthSession, normalizeRole } from "../../../utils/authSession";
import { printReportHtml } from "../../../utils/printUtils";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { buildReportPdfFileName, buildReportTablePrintHtml, downloadReportTableExcel } from "../../../components/reports/shared/ReportPrintTemplate";

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

  
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const session = getAuthSession();
  const roleName = normalizeRole(session?.user?.id_role);

  const getReportData = () => ({
    title: "Activity Logs Report",
    subtitle: "System audit trail",
    reportKey: "activity-logs",
    generatedAt: new Date(),
    generatedBy: roleName,
    meta: [{ label: "Total Logs", value: rows.length }],
    columns: [
      { key: "date", title: "Date", width: 16, getValue: (row: ActivityLogRow) => formatDateTime(row.activity_date) },
      { key: "actor", title: "Actor", width: 18, getValue: (row: ActivityLogRow) => row.actor_name || row.actor_email || "-" },
      { key: "activity", title: "Activity", width: 18, getValue: (row: ActivityLogRow) => formatActivityTypeLabel(row.activity_type) },
      { key: "target", title: "Target", width: 20, getValue: (row: ActivityLogRow) => row.target_label || row.record_id || "-" },
      { key: "description", title: "Description", width: 34, getValue: (row: ActivityLogRow) => row.description || "-" }
    ],
    rows,
  });

  const handlePrint = async () => {
    try {
      const html = buildReportTablePrintHtml(getReportData());
      await printReportHtml(html, { tableName: "tbl_activity_logs", description: "Printed activity logs." });
    } catch (error) {
      setErrorMessage("Failed to print logs.");
    }
  };

  const handleExportExcel = async () => {
    try {
      await downloadReportTableExcel(getReportData());
    } catch (error) {
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
        rows: rows.map(row => {
          const rowData: any = {};
          getReportData().columns.forEach(c => { rowData[c.key] = c.getValue(row); });
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
      const response = await fetchWithAuth("/api/activity-logs?limit=200");
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
        
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable style={styles.refreshButton} onPress={loadLogs} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
          </Pressable>
          <ExportDropdownMenu onExportPdf={handlePrint} onExportExcel={handleExportExcel} onSendEmail={() => setEmailModalOpen(true)} />
        </View>

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
  refreshButton: { height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  rowCell: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
});
