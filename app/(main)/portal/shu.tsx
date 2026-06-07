import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { formatRupiah } from "../../../components/shu/formatters";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import PageContainer from "../../../components/layout/PageContainer";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";

type ShuHistoryRow = {
  id_shu_distribution: string;
  period_name: string;
  start_date: string;
  end_date: string;
  sales_shu_amount: number;
  business_shu_amount: number;
  shu_amount: number;
  distribution_status: string;
};

type OverviewResponse = {
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
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [history, setHistory] = useState<ShuHistoryRow[]>([]);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const showError = (message: string) => {
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
    loadData().catch((error) => {
      showError(error instanceof Error ? error.message : "Failed to load SHU.");
    });
  }, [loadData]);

  const columns = useMemo<InventoryDataTableColumn<ShuHistoryRow>[]>(() => [
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
  ], []);

  return (
    <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <InventoryPageHeader
          title="SHU History"
          subtitle="Track your patronage refund (SHU) distributions over time."
        />

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

      <InventoryResultModal
        visible={resultModalOpen}
        status="error"
        title="Error"
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

const styles = StyleSheet.create({
  scrollContent: { gap: 16, paddingBottom: 8 },
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
});
