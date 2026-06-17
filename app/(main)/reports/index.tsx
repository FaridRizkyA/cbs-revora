import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  canViewExternalFinancial,
  canViewInventory,
  canViewPeople,
  getAuthSession,
  normalizeRole,
} from "../../../utils/authSession";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { printReportHtml } from "../../../utils/printUtils";
import {
  buildColumns,
  buildGenericReportPrintHtml,
  downloadGenericReportExcel,
  GenericReportColumn,
  GenericReportRow,
} from "../../../components/reports/generic/GenericReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import PageContainer from "../../../components/layout/PageContainer";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";

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

export default function ReportsScreen() {
  const [allSources, setAllSources] = useState<ReportSource[]>([]);
  const [roleName, setRoleName] = useState("");
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

  const showResult = useCallback((status: "success" | "error", title: string, message: string) => {
    setResultStatus(status);
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  }, []);

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name));
        setGeneratedBy(session?.user?.full_name || session?.user?.role_name || null);
      })
      .catch(() => setGeneratedBy(null));
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSources(true);
    fetchWithAuth("/api/reports/sources")
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload?.message || "Failed to fetch report data sources.");
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        if (!active) return;
        setAllSources(rows);
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

  const sources = useMemo(() => {
    return allSources.filter((s) => {
      if (s.key === "users" || s.key === "members" || s.key === "staffs") return canViewPeople(roleName);
      if (s.key === "external_financial") return canViewExternalFinancial(roleName);
      if (
        s.key === "suppliers" ||
        s.key === "products" ||
        s.key === "batches" ||
        s.key === "stock_in" ||
        s.key === "stock_out" ||
        s.key === "stock_adjustment"
      ) {
        return canViewInventory(roleName);
      }
      return true;
    });
  }, [allSources, roleName]);

  useEffect(() => {
    if (sources.length > 0 && !sourceKey) {
      setSourceKey(sources[0].key);
    }
  }, [sources, sourceKey]);

  const sourceOptions = useMemo(
    () => sources.map((source) => ({ label: source.label, value: source.key })),
    [sources]
  );

  const handleGenerate = async () => {
    if (!sourceKey) return;
    setGenerating(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({ source: sourceKey });
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const response = await fetchWithAuth(`/api/reports/run?${params.toString()}`);
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

  const handlePrint = async () => {
    if (!result) return;
    try {
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
      
      await printReportHtml(html, {
        tableName: "tbl_activity_logs",
        description: `Printed ${result.source.label} report.`,
        fileName: buildReportPdfFileName({
          reportKey: result.source.key,
          variant: "table",
          date: new Date(),
        }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print report.");
    }
  };

  const handleExportExcel = async () => {
    if (!result) return;
    try {
      await downloadGenericReportExcel({
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        reportKey: `reports-${result.source.key}`,
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
        tableName: "tbl_activity_logs",
        description: `Exported ${result.source.label} report as Excel.`,
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export Excel.");
    }
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    if (!result) return;
    try {
      const generatedAt = new Date();
      const meta = [
        { label: "Data Source", value: result.source.label },
        { label: "Date Range", value: formatDateRangeLabel(result.filters.created_date_from, result.filters.created_date_to) },
      ];

      const printHtml = buildGenericReportPrintHtml({
        reportKey: `reports-${result.source.key}`,
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        columns: result.columns,
        rows: result.rows,
        generatedAt,
        generatedBy,
        meta,
      });

      const reportColumns = buildColumns(result.columns);

      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: `${result.source.label} Report Result`,
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: `${result.source.label} Report`,
        subtitle: "Generated from selected data source and date range",
        generated_by: generatedBy,
        print_html: printHtml,
        meta,
        columns: reportColumns.map((c) => ({ key: c.key, title: c.title, align: c.align })),
        rows: result.rows.map((row, idx) => {
          const rowData: any = {};
          reportColumns.forEach((c) => {
            rowData[c.key] = formatCellValue(c.getValue(row, idx));
          });
          return rowData;
        }),
      };

      const response = await fetchWithAuth("/api/reports/send-email", {
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

      showResult("success", "Email Sent", "Report has been sent successfully.");
    } catch (error) {
      showResult("error", "Email Failed", error instanceof Error ? error.message : "Failed to send email.");
    }
  };

  const tableColumns = useMemo<InventoryDataTableColumn<GenericReportRow>[]>(() => {
    if (!result) return [];
    return result.columns.map((col) => ({
      key: col.key,
      title: col.title,
      weight: 20,
      align: col.align || "left",
      render: (row) => (
        <Text style={[styles.rowCell, col.align === "right" && styles.rowCellRight]}>
          {formatCellValue(row[col.key])}
        </Text>
      ),
    }));
  }, [result]);

  return (
    <PageContainer>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <InventoryPageHeader
          title="Custom Reports"
          subtitle="Generate and export system-wide operational reports."
        />

        <View style={styles.filterCard}>
          <View style={styles.formGrid}>
            <View style={styles.formFieldWide}>
              <FilterSelectField
                label="Data Source"
                value={sourceKey}
                options={sourceOptions}
                onChange={setSourceKey}
                loading={loadingSources}
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
              style={[styles.generateButton, (generating || !sourceKey) && styles.buttonDisabled]}
              onPress={handleGenerate}
              disabled={generating || !sourceKey}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="play" size={16} color="#fff" />
                  <Text style={styles.generateButtonText}>Run Report</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.emptyState}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultBlock}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.sectionTitle}>{result.source.label} Report</Text>
                <Text style={styles.resultMeta}>
                  {result.total_rows} record(s) found • {formatDateRangeLabel(startDate, endDate)}
                </Text>
              </View>
              <ExportDropdownMenu
                onExportPdf={handlePrint}
                onExportExcel={handleExportExcel}
                onSendEmail={() => setEmailModalOpen(true)}
              />
            </View>

            <View style={styles.card}>
              <InventoryDataTable
                columns={tableColumns}
                rows={result.rows}
                rowKey={(row, idx) => `row-${idx}`}
                emptyText="No data matches the selected filters."
              />
            </View>
          </View>
        ) : (
          !generating &&
          !errorMessage && (
            <View style={styles.emptyState}>
              <Feather name="database" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>Select a source and click Run Report to view data.</Text>
            </View>
          )
        )}
      </ScrollView>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSend={handleSendEmailReport}
        reportTitle={result?.source.label || "Report"}
      />

      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 28,
    gap: 16,
  },
  filterCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ee",
  },
  resultBlock: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    overflow: "hidden",
  },
  sectionTitle: {
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
