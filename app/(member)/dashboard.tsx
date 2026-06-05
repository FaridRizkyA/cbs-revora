import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import MemberShell from "../../components/member/MemberShell";
import { formatRupiah } from "../../components/shu/formatters";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { getAuthSession, normalizeRole } from "../../utils/authSession";

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
  current_shu?: {
    distribution_status?: string | null;
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
    let active = true;
    getAuthSession()
      .then(async (session) => {
        if (!active) return;
        if (!session?.token || !normalizeRole(session?.user?.role_name)) {
          router.replace("/login");
          return;
        }

        const accessResponse = await fetchWithAuth("/api/member/access");
        const accessPayload = await accessResponse.json();
        if (!accessResponse.ok || !accessPayload?.data?.is_member) {
          router.replace("/login");
          return;
        }

        loadOverview().catch((error) => {
          Alert.alert("Error", error instanceof Error ? error.message : "Failed to load dashboard.");
        });
      })
      .catch(() => router.replace("/login"));

    return () => {
      active = false;
    };
  }, [loadOverview, router]);

  const totalTransactions = Number(overview?.metrics?.total_transactions || 0);
  const totalSpending = Number(overview?.metrics?.total_spending || 0);
  const currentShu = Number(overview?.metrics?.current_shu_amount || 0);

  const recentTransactions = useMemo(
    () =>
      [...(overview?.recent_transactions || [])].sort((a, b) => {
        const left = new Date(a.sale_date || "").getTime() || 0;
        const right = new Date(b.sale_date || "").getTime() || 0;
        return left - right;
      }),
    [overview?.recent_transactions]
  );

  const trendLabels = useMemo(() => recentTransactions.map((row) => formatChartDate(row.sale_date)), [recentTransactions]);
  const trendData = useMemo(() => recentTransactions.map((row) => Number(row.total_amount || 0)), [recentTransactions]);
  const mixData = useMemo(
    () => [
      { name: "Spending", amount: totalSpending, color: "#2563eb", legendFontColor: "#334155", legendFontSize: 12 },
      { name: "Current SHU", amount: currentShu, color: "#f59e0b", legendFontColor: "#334155", legendFontSize: 12 },
      {
        name: "Transactions",
        amount: totalTransactions,
        color: "#14b8a6",
        legendFontColor: "#334155",
        legendFontSize: 12,
      },
    ].filter((item) => item.amount > 0),
    [currentShu, totalSpending, totalTransactions]
  );

  const hasTrendData = trendData.some((value) => value > 0);
  const hasMixData = mixData.length > 0;

  return (
    <MemberShell
      title="Dashboard"
      subtitle="Your membership overview, spending trend, and current SHU status."
      active="dashboard"
      onNavigate={(key) => router.push(`/(member)/${key}` as never)}
    >
      <View style={styles.summaryRow}>
        <Metric label="Transactions" value={String(totalTransactions)} />
        <Metric label="Spending" value={formatRupiah(totalSpending)} />
        <Metric label="Current SHU" value={formatRupiah(currentShu)} />
      </View>

      <View style={styles.chartGrid}>
        <ChartPanel title="Recent Spending Trend" subtitle="Last transaction values plotted from oldest to newest.">
          {(width) =>
            width > 0 && hasTrendData ? (
              <LineChart
                data={{
                  labels: trendLabels.length > 0 ? trendLabels : [""],
                  datasets: [{ data: trendData }],
                }}
                width={width}
                height={240}
                yAxisLabel=""
                yAxisSuffix=""
                withInnerLines
                withOuterLines={false}
                withShadow={false}
                bezier
                fromZero
                chartConfig={chartConfig}
                style={styles.chart}
              />
            ) : (
              <Text style={styles.emptyState}>No spending data is available yet.</Text>
            )
          }
        </ChartPanel>

        <ChartPanel title="Membership Mix" subtitle="Spending, SHU, and transaction volume.">
          {(width) =>
            width > 0 && hasMixData ? (
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
            ) : (
              <Text style={styles.emptyState}>No balance data is available yet.</Text>
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
          <Pressable style={styles.linkButton} onPress={() => router.push("/(member)/transactions")}>
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
        const nextWidth = Math.max(0, Math.floor(event.nativeEvent.layout.width) - 24);
        if (nextWidth > 0 && nextWidth !== chartWidth) {
          setChartWidth(nextWidth);
        }
      }}
    >
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      <View style={styles.chartBody}>{children(chartWidth)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
