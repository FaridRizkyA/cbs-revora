import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildGenericReportPrintHtml,
  downloadGenericReportExcel,
  GenericReportColumn,
  GenericReportRow,
} from "../../../components/reports/generic/GenericReportPrintTemplate";
import { API_BASE_URL } from "../../../utils/api";
import { logClientActivity } from "../../../utils/activityLog";
import { getAuthSession } from "../../../utils/authSession";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";

type ReportSource = {
  key: string;
  label: string;
  columns: GenericReportColumn[];
};

type ReportResult = {
  source: {
    key: string;
    label: string;
  };
  columns: GenericReportColumn[];
  rows: GenericReportRow[];
  filters: {
    created_date_from: string | null;
    created_date_to: string | null;
  };
  total_rows: number;
};

const formatDateTime = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
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

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return new Intl.NumberFormat("id-ID").format(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
};

const parseDateBound = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateRangeLabel = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "all time";
  if (from && to) return `${formatDateOnly(from)} to ${formatDateOnly(to)}`;
  if (from) return `${formatDateOnly(from)} onward`;
  return `up to ${formatDateOnly(to)}`;
};

const printReportHtml = async (html: string) => {
  if (Platform.OS !== "web") {
    await Print.printAsync({ html });
    return;
  }

  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "width=1024,height=720");
  if (!printWindow) throw new Error("Please allow pop-ups to print this report.");

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
};

export default function ReportsScreen() {
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingSources, setLoadingSources] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [generatedBy, setGeneratedBy] = useState<string | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const showResult = (status: "success" | "error", title: string, message: string) => {
    setResultStatus(status);
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  };

  useEffect(() => {
    getAuthSession()
      .then((session) => setGeneratedBy(session?.user?.full_name || session?.user?.role_name || null))
      .catch(() => setGeneratedBy(null));
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSources(true);
    fetch(`${API_BASE_URL}/api/reports/sources`)
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload?.message || "Failed to fetch report data sources.");
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        if (!active) return;
        setSources(rows);
        setSourceKey((current) => current || rows[0]?.key || "");
      })
      .catch((error) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Failed to fetch report data sources.");
      })
      .finally(() => {
        if (active) setLoadingSources(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sourceOptions = useMemo(
    () => sources.map((source) => ({ label: source.label, value: source.key })),
    [sources]
  );

  const columns = useMemo<InventoryDataTableColumn<GenericReportRow>[]>(() => {
    const sourceColumns = result?.columns || [];
    return [
      {
        key: "row_number",
        title: "No.",
        width: 56,
        align: "center",
        render: (_row, meta) => <Text style={styles.rowCell}>{meta.rowIndex + 1}</Text>,
      },
      ...sourceColumns.map((column) => ({
        key: column.key,
        title: column.title,
        align: column.align,
        sortable: true,
        sortValue: (row: GenericReportRow) => {
          const value = row[column.key];
          return typeof value === "number" ? value : String(value || "");
        },
        render: (row: GenericReportRow) => (
          <Text style={[styles.rowCell, column.align === "right" ? styles.rowCellRight : null]}>
            {formatCellValue(row[column.key])}
          </Text>
        ),
      })),
    ];
  }, [result?.columns]);

  const handleGenerate = async () => {
    if (!sourceKey) {
      showResult("error", "Select Data Source", "Please select a report data source first.");
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      showResult("error", "Invalid Date Range", "Start date cannot be later than end date.");
      return;
    }

    setGenerating(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({ source: sourceKey });
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const response = await fetch(`${API_BASE_URL}/api/reports/run?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Failed to generate report.");
      setResult(payload.data || null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate report.");
      setResult(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;

    try {
      await logClientActivity({
        activityType: "PRINT_REPORT",
        description: `Printed generated ${result.source.label} report for ${formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to)}.`,
      });
      const html = buildGenericReportPrintHtml({
        reportKey: `reports-${result.source.key}`,
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        columns: result.columns,
        rows: result.rows,
        generatedAt: new Date(),
        generatedBy,
        meta: [
          { label: "Data Source", value: result.source.label },
          { label: "Date Range", value: formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to) },
        ],
      });
      await printReportHtml(html);
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to export report.");
    }
  };

  const handleExportExcel = async () => {
    if (!result) return;

    try {
      await downloadGenericReportExcel({
        reportKey: `reports-${result.source.key}`,
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        columns: result.columns,
        rows: result.rows,
        generatedAt: new Date(),
        generatedBy,
        meta: [
          { label: "Data Source", value: result.source.label },
          { label: "Date Range", value: formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to) },
        ],
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        description: `Exported generated ${result.source.label} report as Excel.`,
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export report as Excel.");
    }
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string) => {
    if (!result) return;
    try {
      const generatedAt = new Date();
      const printHtml = buildGenericReportPrintHtml({
        reportKey: `reports-${result.source.key}`,
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        columns: result.columns,
        rows: result.rows,
        generatedAt,
        generatedBy,
        meta: [
          { label: "Data Source", value: result.source.label },
          { label: "Date Range", value: formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to) },
        ],
      });
      const payload = {
        recipient_email: recipientEmail,
        subject: `${result.source.label} Report Result`,
        message,
        format: "PDF",
        title: `${result.source.label} Report`,
        generated_by: generatedBy,
        print_html: printHtml,
        meta: [
          { label: "Data Source", value: result.source.label },
          { label: "Date Range", value: formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to) },
          { label: "Total Rows", value: String(result.total_rows) },
        ],
        columns: result.columns,
        rows: result.rows,
      };

      const response = await fetch(`${API_BASE_URL}/api/reports/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_reports",
        description: `Sent ${result.source.label} report via email.`,
      });

      showResult("success", "Email Sent", "Email sent successfully.");
    } catch (error) {
      showResult("error", "Email Failed", error instanceof Error ? error.message : "Failed to send email.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>Generate table reports from selected data sources and created date ranges.</Text>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Report Builder</Text>
        <View style={styles.formGrid}>
          <View style={styles.formFieldWide}>
            <FilterSelectField
              label="Data Source"
              value={sourceKey}
              options={sourceOptions}
              onChange={setSourceKey}
            />
          </View>
          <View style={styles.formField}>
            <DatePickerField
              label="Date From"
              value={startDate}
              placeholder="YYYY-MM-DD"
              onChange={setStartDate}
              maximumDate={parseDateBound(endDate)}
            />
          </View>
          <View style={styles.formField}>
            <DatePickerField
              label="Date To"
              value={endDate}
              placeholder="YYYY-MM-DD"
              onChange={setEndDate}
              minimumDate={parseDateBound(startDate)}
            />
          </View>
          <Pressable
            style={[styles.generateButton, (!sourceKey || generating || loadingSources) ? styles.buttonDisabled : null]}
            onPress={handleGenerate}
            disabled={!sourceKey || generating || loadingSources}
          >
            <MaterialCommunityIcons name="table-search" size={18} color="#ffffff" />
            <Text style={styles.generateButtonText}>{generating ? "Generating..." : "Generate"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.resultHeader}>
          <View>
            <Text style={styles.cardTitle}>{result ? `${result.source.label} Report Result` : "Report Result"}</Text>
            <Text style={styles.resultMeta}>
              {result
                ? `${result.total_rows} row(s), ${formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to)}`
                : "Generate a report to show table data."}
            </Text>
          </View>
          <ExportDropdownMenu
            onExportPdf={handleExport}
            onExportExcel={handleExportExcel}
            onSendEmail={() => setEmailModalOpen(true)}
          />
        </View>

        {result ? (
          <InventoryDataTable
            columns={columns}
            rows={result.rows}
            rowKey={(row) => String(row.id || JSON.stringify(row))}
            emptyText="No report rows found."
            initialPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            minWidth={900}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No generated report yet.</Text>
          </View>
        )}
      </View>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={result ? `${result.source.label} Report` : "Report"}
        onSend={handleSendEmailReport}
      />
      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  formGrid: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  formFieldWide: {
    flex: 1.4,
  },
  formField: {
    flex: 1,
    gap: 6,
  },
  generateButton: {
    height: 42,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
  generateButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultMeta: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  exportButtonDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  rowCell: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  rowCellRight: {
    textAlign: "right",
  },
  emptyState: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 18,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
});
