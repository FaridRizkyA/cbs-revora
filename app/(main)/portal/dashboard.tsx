import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import { formatRupiah } from "../../../components/shu/formatters";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import PageContainer from "../../../components/layout/PageContainer";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";

const isWeb = Platform.OS === "web";
let WebLineChart: any = null;
let WebPieChart: any = null;
let webChartOptions: any = null;

if (isWeb) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactChart = require("react-chartjs-2");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chartJs = require("chart.js");
  chartJs.Chart.register(...chartJs.registerables);

  WebLineChart = reactChart.Line;
  WebPieChart = reactChart.Pie;
  webChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" as const },
    },
  };
}

type RecentTransaction = {
  id_sale: string;
  sale_number?: string | null;
  sale_date?: string | null;
  payment_method?: string | null;
  total_amount?: number | null;
  item_count?: number | null;
};

type MemberOverview = {
  member: {
    member_code?: string | null;
    member_name?: string | null;
  };
  metrics: {
    total_transactions?: number;
    total_spending?: number;
    current_shu_amount?: number;
    current_shu_status?: string;
    current_shu_period?: string;
  };
  recent_transactions?: RecentTransaction[];
  monthly_trend?: {
    month_label: string;
    total_spending: number;
  }[];
  current_shu?: {
    distribution_status?: string | null;
    sales_shu_amount?: number | null;
    business_shu_amount?: number | null;
    shu_amount?: number | null;
    period?: {
      period_name?: string | null;
    } | null;
  } | null;
};

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
  labelColor: () => "#64748b",
  decimalPlaces: 0,
  propsForBackgroundLines: {
    stroke: "#e2e8f0",
  },
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#1d4ed8",
  },
};

const formatChartDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MemberDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<MemberOverview | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const showError = (message: string) => {
    setResultMessage(message);
    setResultModalOpen(true);
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/member/overview");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load dashboard.");
      }
      setOverview(payload?.data || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview().catch((error) => showError(error instanceof Error ? error.message : "Failed to load dashboard."));
  }, [loadOverview]);

  const totalTransactions = Number(overview?.metrics?.total_transactions || 0);
  const totalSpending = Number(overview?.metrics?.total_spending || 0);
  const currentShu = Number(overview?.metrics?.current_shu_amount || 0);

  const salesShu = Number(overview?.current_shu?.sales_shu_amount || 0);
  const businessShu = Number(overview?.current_shu?.business_shu_amount || 0);

  const recentTransactions = useMemo(
    () =>
      [...(overview?.recent_transactions || [])].sort((a, b) => {
        const left = new Date(a.sale_date || "").getTime() || 0;
        const right = new Date(b.sale_date || "").getTime() || 0;
        return left - right;
      }),
    [overview?.recent_transactions]
  );

  const trendLabels = useMemo(() => {
    const labels = (overview?.monthly_trend || []).map((row) => row.month_label.split(" ")[0]);
    return labels.length > 0 ? labels : ["No data"];
  }, [overview?.monthly_trend]);

  const trendData = useMemo(() => {
    const data = (overview?.monthly_trend || []).map((row) => Number(row.total_spending || 0));
    return data.length > 0 ? data : [0];
  }, [overview?.monthly_trend]);

  const mixData = useMemo(
    () => [
      { name: "Sales SHU", amount: salesShu, color: "#14b8a6", legendFontColor: "#334155", legendFontSize: 12 },
      { name: "Business SHU", amount: businessShu, color: "#f59e0b", legendFontColor: "#334155", legendFontSize: 12 },
    ].filter((item) => item.amount > 0),
    [salesShu, businessShu]
  );

  const hasTrendData = trendData.length > 0 && trendData.some((value) => value > 0);
  const hasMixData = mixData.length > 0;

  return (
    <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <InventoryPageHeader
          title="Dashboard"
          subtitle="Your membership overview, spending trend, and current SHU status."
        />

        <View style={styles.summaryRow}>
          <Metric label="Transactions" value={String(totalTransactions)} />
          <Metric label="Spending" value={formatRupiah(totalSpending)} />
          <Metric label="Current SHU" value={formatRupiah(currentShu)} />
        </View>

        <View style={styles.chartGrid}>
          <ChartPanel title="Spending Trend" subtitle="Monthly spending over the last 6 months.">
            {(width) =>
              width > 0 && hasTrendData ? (
                isWeb ? (
                  <View style={styles.webChartWrap}>
                    <WebLineChart
                      options={webChartOptions}
                      data={{
                        labels: trendLabels,
                        datasets: [
                          {
                            label: "Monthly Spending",
                            data: trendData,
                            borderColor: "#2563eb",
                            backgroundColor: "rgba(37,99,235,0.2)",
                            tension: 0.35,
                          },
                        ],
                      }}
                    />
                  </View>
                ) : (
                  <LineChart
                    data={{
                      labels: trendLabels,
                      datasets: [{ data: trendData }],
                    }}
                    width={width}
                    height={240}
                    yAxisLabel="Rp "
                    yAxisSuffix=""
                    withInnerLines
                    withOuterLines={false}
                    withShadow={false}
                    bezier
                    fromZero
                    onDataPointClick={() => undefined}
                    chartConfig={chartConfig}
                    style={styles.chart}
                  />
                )
              ) : (
                <Text style={styles.emptyState}>No spending data is available yet.</Text>
              )
            }
          </ChartPanel>

          <ChartPanel title="SHU Breakdown" subtitle="Ratio of Sales SHU vs Business SHU.">
            {(width) =>
              width > 0 && hasMixData ? (
                isWeb ? (
                  <View style={styles.webChartWrap}>
                    <WebPieChart
                      options={webChartOptions}
                      data={{
                        labels: mixData.map((item) => item.name),
                        datasets: [
                          {
                            data: mixData.map((item) => item.amount),
                            backgroundColor: mixData.map((item) => item.color),
                          },
                        ],
                      }}
                    />
                  </View>
                ) : (
                  <PieChart
                    data={mixData.map((item) => ({
                      name: item.name,
                      population: item.amount,
                      color: item.color,
                      legendFontColor: item.legendFontColor,
                      legendFontSize: item.legendFontSize,
                    }))}
                    width={width}
                    height={220}
                    chartConfig={chartConfig}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="8"
                    absolute
                  />
                )
              ) : (
                <Text style={styles.emptyState}>No SHU distribution data for the current period.</Text>
              )
            }
          </ChartPanel>
        </View>

        <View style={styles.listCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <Text style={styles.sectionSubtitle}>Quick view of your latest purchases.</Text>
            </View>
            <Pressable style={styles.linkButton} onPress={() => router.push("/(main)/portal/transactions")}>
              <Feather name="arrow-right" size={14} color="#1d4ed8" />
              <Text style={styles.linkButtonText}>View All</Text>
            </Pressable>
          </View>

          {loading ? <Text style={styles.stateText}>Loading dashboard...</Text> : null}

          {!loading && recentTransactions.length === 0 ? (
            <Text style={styles.emptyState}>No transactions have been recorded yet.</Text>
          ) : null}

          <View style={styles.transactionList}>
            {recentTransactions.map((row) => (
              <View key={row.id_sale} style={styles.transactionRow}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionTitle}>{row.sale_number || "-"}</Text>
                  <Text style={styles.transactionMeta}>
                    {formatShortDateTime(row.sale_date)} • {row.payment_method || "-"} • {String(row.item_count || 0)} item(s)
                  </Text>
                </View>
                <Text style={styles.transactionAmount}>{formatRupiah(Number(row.total_amount || 0))}</Text>
              </View>
            ))}
          </View>
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

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: (width: number) => ReactNode;
}) {
  const [chartWidth, setChartWidth] = useState(0);

  return (
    <View
      style={styles.chartCard}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        const nextWidth = Math.max(0, Math.floor(width) - 32);
        if (nextWidth > 0 && nextWidth !== chartWidth) {
          setChartWidth(nextWidth);
        }
      }}
    >
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      <View style={styles.chartBody}>{chartWidth > 0 ? children(chartWidth) : null}</View>
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
  chartGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  chartCard: {
    flexBasis: "49%",
    flexGrow: 1,
    minWidth: 280,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    padding: 12,
    gap: 4,
  },
  chartTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  chartSubtitle: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  chartBody: { paddingTop: 4 },
  webChartWrap: { height: 220, width: "100%" },
  chart: {
    borderRadius: 14,
  },
  emptyState: {
    color: "#64748b",
    fontSize: 12,
    paddingVertical: 12,
  },
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  sectionSubtitle: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  linkButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  linkButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  stateText: { color: "#64748b", fontSize: 12 },
  transactionList: { gap: 8 },
  transactionRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  transactionLeft: { flex: 1, gap: 3 },
  transactionTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  transactionMeta: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  transactionAmount: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
});
