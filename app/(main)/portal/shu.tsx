import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import { formatRupiah } from "../../../components/shu/formatters";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import PageContainer from "../../../components/layout/PageContainer";
import {
  buildMemberShuHistoryReportPrintHtml,
  buildMemberShuDetailReportPrintHtml,
  downloadMemberShuHistoryReportExcel,
  downloadMemberShuDetailReportExcel,
  MemberShuHistoryRow
} from "../../../components/reports/member/MemberShuReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { logClientActivity } from "../../../utils/activityLog";
import { printReportHtml } from "../../../utils/printUtils";
import { getAuthSession, AuthSession } from "../../../utils/authSession";

type OverviewResponse = {
  member: {
    member_code?: string | null;
    full_name?: string | null;
    email?: string | null;
  };
  metrics: {
    total_spending: number;
    current_shu_amount: number;
    current_shu_status: string;
    current_shu_period: string;
  };
  current_shu?: {
    sales_shu_amount: number;
    business_shu_amount: number;
  } | null;
};

export default function MemberShuScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roleName, setRoleName] = useState("MEMBER");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [history, setHistory] = useState<MemberShuHistoryRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<MemberShuHistoryRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewResponse, historyResponse] = await Promise.all([
        fetchWithAuth("/api/member/overview"),
        fetchWithAuth("/api/member/shu-history"),
      ]);

      const overviewPayload = await overviewResponse.json();
      const historyPayload = await historyResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(overviewPayload?.message || "Failed to load SHU overview.");
      }
      if (!historyResponse.ok) {
        throw new Error(historyPayload?.message || "Failed to load SHU history.");
      }

      setOverview(overviewPayload?.data || null);
      setHistory(Array.isArray(historyPayload?.data) ? historyPayload.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAuthSession().then(s => {
      setSession(s);
      if (s?.user?.role_name) setRoleName(s.user.role_name);
    });
    loadData().catch((error) => {
      showResult("error", "Error", error instanceof Error ? error.message : "Failed to load SHU.");
    });
  }, [loadData]);

  const handlePrintShuHistoryTable = async () => {
    try {
      const html = buildMemberShuHistoryReportPrintHtml({
        rows: history,
        memberName: overview?.member.full_name || session?.user?.full_name || "Member",
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html, {
        tableName: "tbl_shu_distributions",
        description: "Printed member SHU history report.",
        fileName: buildReportPdfFileName({ reportKey: "member-shu-history", variant: "table", date: new Date() }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print SHU history.");
    }
  };

  const handleExportShuHistoryExcel = async () => {
    try {
      await downloadMemberShuHistoryReportExcel({
        rows: history,
        memberName: overview?.member.full_name || session?.user?.full_name || "Member",
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_shu_distributions",
        description: "Exported member SHU history as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export SHU history.");
    }
  };

  const handlePrintShuDetail = async () => {
    if (!selectedRow) return;
    try {
      const html = buildMemberShuDetailReportPrintHtml({
        row: selectedRow,
        memberName: overview?.member.full_name || session?.user?.full_name || "Member",
        memberCode: overview?.member.member_code,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html, {
        tableName: "tbl_shu_distributions",
        description: `Printed member SHU detail for period ${selectedRow.period_name}.`,
        fileName: buildReportPdfFileName({ 
          reportKey: "member-shu-slip", 
          variant: "detail", 
          documentNumber: selectedRow.period_name,
          date: new Date() 
        }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print SHU detail.");
    }
  };

  const handleExportShuDetailExcel = async () => {
    if (!selectedRow) return;
    try {
      await downloadMemberShuDetailReportExcel({
        row: selectedRow,
        memberName: overview?.member.full_name || session?.user?.full_name || "Member",
        memberCode: overview?.member.member_code,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_shu_distributions",
        description: `Exported member SHU detail as Excel for period ${selectedRow.period_name}.`,
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export SHU detail.");
    }
  };

  const columns = useMemo<InventoryDataTableColumn<MemberShuHistoryRow>[]>(() => [
    {
      key: "period_name",
      title: "Period",
      weight: 18,
      sortable: true,
      render: (row) => <Text style={styles.cellText}>{row.period_name}</Text>,
    },
    {
      key: "range",
      title: "Date Range",
      weight: 22,
      render: (row) => (
        <Text style={[styles.cellText, { color: "#64748b" }]}>
          {new Date(row.start_date).toLocaleDateString("id-ID")} - {new Date(row.end_date).toLocaleDateString("id-ID")}
        </Text>
      ),
    },
    {
      key: "sales_shu",
      title: "Sales SHU",
      weight: 16,
      align: "right",
      render: (row) => <Text style={styles.cellText}>{formatRupiah(row.sales_shu_amount)}</Text>,
    },
    {
      key: "business_shu",
      title: "Business SHU",
      weight: 16,
      align: "right",
      render: (row) => <Text style={styles.cellText}>{formatRupiah(row.business_shu_amount)}</Text>,
    },
    {
      key: "total_shu",
      title: "Total SHU",
      weight: 16,
      align: "right",
      render: (row) => <Text style={[styles.cellText, { fontWeight: "800" }]}>{formatRupiah(row.shu_amount)}</Text>,
    },
    {
      key: "status",
      title: "Status",
      weight: 12,
      align: "center",
      render: (row) => (
        <View style={[styles.statusBadge, row.distribution_status === "PAID" ? styles.statusPaid : styles.statusPending]}>
          <Text style={[styles.statusText, row.distribution_status === "PAID" ? styles.statusTextPaid : styles.statusTextPending]}>
            {row.distribution_status}
          </Text>
        </View>
      ),
    },
    {
      key: "action",
      title: "Action",
      weight: 12,
      align: "center",
      render: (row) => (
        <Pressable
          style={styles.detailButton}
          onPress={() => {
            setSelectedRow(row);
            setDetailOpen(true);
          }}
        >
          <Text style={styles.detailButtonText}>Detail</Text>
        </Pressable>
      ),
    },
  ], []);

  return (
    <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.pageTitle}>SHU History</Text>
            <Text style={styles.pageSubtitle}>Track your patronage refund (SHU) distributions over time.</Text>
          </View>
          <View style={styles.headerActions}>
            <ExportDropdownMenu
              onExportPdf={handlePrintShuHistoryTable}
              onExportExcel={handleExportShuHistoryExcel}
            />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Metric label="Current SHU" value={formatRupiah(overview?.metrics.current_shu_amount || 0)} />
          <Metric label="Current Period" value={overview?.metrics.current_shu_period || "-"} />
          <Metric label="Status" value={overview?.metrics.current_shu_status || "-"} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Distribution History</Text>
          </View>
          {loading ? (
            <Text style={styles.stateText}>Loading distribution records...</Text>
          ) : (
            <InventoryDataTable
              columns={columns}
              rows={history}
              rowKey={(row) => row.id_shu_distribution}
              emptyText="No SHU distribution history found."
            />
          )}
        </View>
      </ScrollView>

      <ResponsiveModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidthDesktop={1024}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.92}
        maxHeightPhoneRatio={0.92}
        cardStyle={styles.modalCard}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>SHU Distribution Slip</Text>
          <View style={styles.modalActionRow}>
            <ExportDropdownMenu
              variant="detail"
              onExportPdf={handlePrintShuDetail}
              onExportExcel={handleExportShuDetailExcel}
            />
          </View>
        </View>

        {selectedRow ? (
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailGrid}>
              <Detail label="Period" value={selectedRow.period_name} />
              <Detail label="Date Range" value={`${new Date(selectedRow.start_date).toLocaleDateString("id-ID")} - ${new Date(selectedRow.end_date).toLocaleDateString("id-ID")}`} />
              <Detail label="Status" value={selectedRow.distribution_status} />
              <Detail label="Total Spending" value={formatRupiah(Number(selectedRow.member_total_spending || 0))} />
              <Detail label="Spending Percentage" value={`${(Number(selectedRow.spending_percentage || 0) * 100).toFixed(2)}%`} />
              <Detail label="Sales SHU" value={formatRupiah(selectedRow.sales_shu_amount)} />
              <Detail label="Business SHU" value={formatRupiah(selectedRow.business_shu_amount)} />
              <Detail label="Total SHU" value={formatRupiah(selectedRow.shu_amount)} />
            </View>
          </ScrollView>
        ) : null}

        <View style={styles.modalFooter}>
          <Pressable style={styles.modalGhostButton} onPress={() => setDetailOpen(false)}>
            <Text style={styles.modalGhostButtonText}>Close</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Detail({ label, value, fullWidth = false }: { label: string; value: string | null; fullWidth?: boolean }) {
  return (
    <View style={[styles.detailCard, fullWidth && styles.detailCardFull]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: 16, paddingBottom: 8 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  headerInfo: { flex: 1, gap: 2 },
  pageTitle: { fontSize: 28, color: "#0f2852", fontWeight: "800" },
  pageSubtitle: { color: "#64748b", fontSize: 13 },
  headerActions: { alignItems: "flex-end" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  metricCard: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    padding: 12,
    gap: 4,
  },
  metricLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metricValue: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  cardHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPaid: { backgroundColor: "#e9f8ef" },
  statusPending: { backgroundColor: "#fff7ea" },
  statusText: { fontSize: 10, fontWeight: "800" },
  statusTextPaid: { color: "#16a34a" },
  statusTextPending: { color: "#d97706" },
  stateText: { color: "#64748b", fontSize: 12, padding: 16 },
  cellText: { color: "#0f172a", fontSize: 12 },
  detailButton: {
    minHeight: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailButtonText: { color: "#334155", fontSize: 11, fontWeight: "700" },
  modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  modalActionRow: { flexDirection: "row", gap: 8 },
  modalContent: { gap: 14, paddingBottom: 4 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailCard: {
    flexBasis: "32%",
    flexGrow: 1,
    minWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4,
  },
  detailCardFull: { flexBasis: "100%" },
  detailLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  detailValue: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end" },
  modalGhostButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostButtonText: { color: "#334155", fontSize: 12, fontWeight: "800" },
});
