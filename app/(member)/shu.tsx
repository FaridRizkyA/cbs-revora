import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { InventoryResultModal } from "../../components/inventory/ActionModals";
import MemberShell from "../../components/member/MemberShell";
import InventoryDataTable, { InventoryDataTableColumn } from "../../components/inventory/InventoryDataTable";
import { formatDate, formatRupiah } from "../../components/shu/formatters";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { getAuthSession } from "../../utils/authSession";

type OverviewResponse = {
  member: {
    member_code?: string | null;
  };
  metrics: {
    current_shu_amount?: number;
    current_shu_status?: string;
    current_shu_period?: string;
  };
  current_shu?: {
    period?: {
      period_name?: string;
      start_date?: string;
      end_date?: string;
      calculation_status?: string;
    };
    shu_amount?: number;
    distribution_status?: string;
  } | null;
};

type ShuHistoryRow = {
  id_shu_distribution: string;
  period_name?: string;
  start_date?: string;
  end_date?: string;
  calculation_status?: string;
  member_total_spending?: number;
  spending_percentage?: number;
  eligible_business_shu?: boolean;
  sales_shu_amount?: number;
  business_shu_amount?: number;
  shu_amount?: number;
  distribution_status?: string;
};

const normalizeStatus = (value?: string | null) => (String(value || "").toUpperCase() === "FINALIZED" ? "Finalized" : "Ongoing");

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
      sortValue: (row) => row.start_date || row.period_name || "",
      render: (row) => (
        <Text style={styles.cellText}>
          {row.period_name || "-"} {row.start_date && row.end_date ? `(${formatDate(row.start_date)} - ${formatDate(row.end_date)})` : ""}
        </Text>
      ),
    },
    {
      key: "spending",
      title: "Spending",
      weight: 16,
      align: "right",
      sortable: true,
      sortValue: (row) => Number(row.member_total_spending || 0),
      render: (row) => <Text style={styles.cellText}>{formatRupiah(Number(row.member_total_spending || 0))}</Text>,
    },
    {
      key: "ratio",
      title: "Ratio",
      weight: 10,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.spending_percentage || 0),
      render: (row) => <Text style={styles.cellText}>{`${((Number(row.spending_percentage || 0)) * 100).toFixed(2)}%`}</Text>,
    },
    {
      key: "business",
      title: "Business",
      weight: 10,
      align: "center",
      sortable: true,
      sortValue: (row) => (row.eligible_business_shu ? 1 : 0),
      render: (row) => <Text style={styles.cellText}>{row.eligible_business_shu ? "Eligible" : "No"}</Text>,
    },
    {
      key: "sales_shu",
      title: "Sales SHU",
      weight: 14,
      align: "right",
      sortable: true,
      sortValue: (row) => Number(row.sales_shu_amount || 0),
      render: (row) => <Text style={styles.cellText}>{formatRupiah(Number(row.sales_shu_amount || 0))}</Text>,
    },
    {
      key: "business_shu",
      title: "Business SHU",
      weight: 14,
      align: "right",
      sortable: true,
      sortValue: (row) => Number(row.business_shu_amount || 0),
      render: (row) => <Text style={styles.cellText}>{formatRupiah(Number(row.business_shu_amount || 0))}</Text>,
    },
    {
      key: "shu_total",
      title: "Total SHU",
      weight: 12,
      align: "right",
      sortable: true,
      sortValue: (row) => Number(row.shu_amount || 0),
      render: (row) => <Text style={styles.cellText}>{formatRupiah(Number(row.shu_amount || 0))}</Text>,
    },
    {
      key: "status",
      title: "SHU Status",
      weight: 14,
      align: "center",
      sortable: true,
      sortValue: (row) => row.distribution_status || row.calculation_status || "",
      render: (row) => <Text style={styles.cellText}>{normalizeStatus(row.distribution_status || row.calculation_status)}</Text>,
    },
  ], []);

  const currentAmount = overview?.current_shu?.shu_amount ?? overview?.metrics?.current_shu_amount ?? 0;
  const currentPeriod = overview?.current_shu?.period?.period_name || overview?.metrics?.current_shu_period || "-";
  const currentStatus = normalizeStatus(overview?.current_shu?.distribution_status || overview?.metrics?.current_shu_status);

  return (
    <MemberShell
      title="SHU"
      subtitle="Check your current estimate and the history of finalized distributions."
      active="shu"
      onNavigate={(key) => router.push(`/(member)/${key}` as never)}
      rightAction={<Text style={styles.statusPill}>{currentStatus}</Text>}
    >
      <View style={styles.summaryRow}>
        <Metric label="Current Estimate" value={formatRupiah(Number(currentAmount || 0))} />
        <Metric label="Current Status" value={currentStatus} />
        <Metric label="Current Period" value={currentPeriod} />
        <Metric label="History Rows" value={String(history.length)} />
      </View>

      <View style={styles.card}>
        {loading ? <Text style={styles.stateText}>Loading SHU data...</Text> : null}
        <InventoryDataTable
          columns={columns}
          rows={history}
          rowKey={(row) => row.id_shu_distribution}
          emptyText="No SHU history found."
        />
      </View>
      <InventoryResultModal
        visible={resultModalOpen}
        status="error"
        title="Error"
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </MemberShell>
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
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    flexBasis: "24%",
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
  stateText: { color: "#64748b", fontSize: 12, padding: 12 },
  cellText: { color: "#0f172a", fontSize: 12 },
});
