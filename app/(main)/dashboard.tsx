import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart, LineChart, ProgressChart } from "react-native-chart-kit";

type SummaryResponse = {
  total_sales: number;
  total_transactions: number;
  today_transactions: number;
  expired_batch_count: number;
  near_expired_batch_count: number;
};

type LineGraphItem = {
  month_key: string;
  month_label: string;
  total_profit: number;
  total_transactions: number;
};

type PieGraphItem = {
  id_product: string;
  product_name: string;
  available_stock: number;
  percentage: number;
};

type BarGraphItem = {
  id_product: string;
  product_name: string;
  transaction_count: number;
  total_quantity: number;
};

type DonutGraphItem = {
  safe_stock: number;
  low_stock: number;
  out_of_stock: number;
};

type GraphsResponse = {
  line_graph: LineGraphItem[];
  pie_graph: PieGraphItem[];
  bar_graph: BarGraphItem[];
  donut_graph: DonutGraphItem;
};

type RecentTransactionItem = {
  id_sale: string;
  sale_number: string;
  sale_date: string;
  member_name: string;
  item_count: number;
  total_amount: number;
  payment_method: string;
};

const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:3000`;
};

const API_BASE_URL = getApiBaseUrl();

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value || 0)
    .replace(/\s/g, " ");

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [graphs, setGraphs] = useState<GraphsResponse | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [summaryRes, graphsRes, recentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/summaryCard`),
        fetch(`${API_BASE_URL}/api/dashboard/graphs`),
        fetch(`${API_BASE_URL}/api/dashboard/recentTransaction?limit=10`),
      ]);

      const [summaryPayload, graphsPayload, recentPayload] = await Promise.all([
        summaryRes.json(),
        graphsRes.json(),
        recentRes.json(),
      ]);

      if (!summaryRes.ok) throw new Error(summaryPayload.message || "Failed to load summary cards.");
      if (!graphsRes.ok) throw new Error(graphsPayload.message || "Failed to load graphs.");
      if (!recentRes.ok) throw new Error(recentPayload.message || "Failed to load recent transactions.");

      setSummary(summaryPayload.data);
      setGraphs(graphsPayload.data);
      setRecentTransactions(recentPayload.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const topStockProducts = useMemo(() => (graphs?.pie_graph ?? []).slice(0, 8), [graphs?.pie_graph]);
  const topTransactions = graphs?.bar_graph ?? [];
  const donut = graphs?.donut_graph ?? { safe_stock: 0, low_stock: 0, out_of_stock: 0 };
  const lineRows = graphs?.line_graph ?? [];
  const chartWidth = Math.max(300, Math.min(560, width - 360));

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
    propsForBackgroundLines: {
      stroke: "#e2e8f0",
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 11,
    },
  } as const;

  const donutTotal = donut.safe_stock + donut.low_stock + donut.out_of_stock;
  const donutData =
    donutTotal > 0
      ? [donut.safe_stock / donutTotal, donut.low_stock / donutTotal, donut.out_of_stock / donutTotal]
      : [0, 0, 0];
  const stockShareData = topStockProducts.map((item) => Math.max(0, item.percentage / 100));

  const summaryCards = [
    {
      id: "sales",
      title: "Total Sales",
      value: formatRupiah(summary?.total_sales ?? 0),
      caption: `${summary?.total_transactions ?? 0} transactions`,
      icon: "dollar-sign",
      iconBg: "#e8f0ff",
      iconColor: "#2563eb",
    },
    {
      id: "transactions",
      title: "Total Transactions",
      value: String(summary?.total_transactions ?? 0),
      caption: `Today: ${summary?.today_transactions ?? 0}`,
      icon: "activity",
      iconBg: "#e9f8ef",
      iconColor: "#16a34a",
    },
    {
      id: "expired",
      title: "Expired Batches",
      value: String(summary?.expired_batch_count ?? 0),
      caption: "Already expired",
      icon: "alert-triangle",
      iconBg: "#fff1f1",
      iconColor: "#ef4444",
    },
    {
      id: "near-expired",
      title: "Near Expiry",
      value: String(summary?.near_expired_batch_count ?? 0),
      caption: "Within 14 days",
      icon: "clock",
      iconBg: "#fff7ea",
      iconColor: "#d97706",
    },
  ] as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#2563eb" />
          <Text style={styles.stateText}>Loading dashboard...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={loadDashboard}>
            <Text style={styles.retryText}>Reload</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <View key={card.id} style={styles.summaryCard}>
                <View style={[styles.summaryIconWrap, { backgroundColor: card.iconBg }]}>
                  <Feather name={card.icon} size={20} color={card.iconColor} />
                </View>
                <Text style={styles.summaryTitle}>{card.title}</Text>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryCaption}>{card.caption}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chartRow}>
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Profit (Last 6 Months)</Text>
              <LineChart
                data={{
                  labels: lineRows.map((row) => row.month_label),
                  datasets: [{ data: lineRows.map((row) => row.total_profit || 0) }],
                }}
                width={chartWidth}
                height={230}
                chartConfig={chartConfig}
                bezier
                style={styles.chartKit}
                withInnerLines
                withOuterLines={false}
                yAxisLabel="Rp "
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Transactions (Last 6 Months)</Text>
              <LineChart
                data={{
                  labels: lineRows.map((row) => row.month_label),
                  datasets: [{ data: lineRows.map((row) => row.total_transactions || 0) }],
                }}
                width={chartWidth}
                height={230}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
                }}
                bezier
                style={styles.chartKit}
                withInnerLines
                withOuterLines={false}
              />
            </View>
          </View>

          <View style={styles.chartRow}>
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Stock Distribution by Product</Text>
              <ProgressChart
                data={{
                  labels: topStockProducts.map((item) => item.product_name.slice(0, 10)),
                  data: stockShareData.length ? stockShareData : [0],
                }}
                width={chartWidth}
                height={230}
                strokeWidth={16}
                radius={30}
                chartConfig={chartConfig}
                hideLegend={false}
                style={styles.chartKit}
              />
              <View style={styles.legendRow}>
                {topStockProducts.map((item) => (
                  <Text key={item.id_product} style={styles.legendText}>
                    {item.product_name}: {item.percentage.toFixed(1)}%
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Top 3 Most Transacted Products</Text>
              <BarChart
                data={{
                  labels: topTransactions.map((item) => item.product_name.slice(0, 8)),
                  datasets: [{ data: topTransactions.map((item) => item.transaction_count || 0) }],
                }}
                width={chartWidth}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={styles.chartKit}
                fromZero
                withInnerLines
              />
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Stock Health (Safe / Low / Out)</Text>
            <ProgressChart
              data={{
                labels: ["Safe", "Low", "Out"],
                data: donutData,
              }}
              width={chartWidth}
              height={220}
              strokeWidth={20}
              radius={38}
              chartConfig={chartConfig}
              hideLegend={false}
              style={styles.chartKit}
            />
            <View style={styles.legendRow}>
              <Text style={styles.legendText}>Safe: {donut.safe_stock}</Text>
              <Text style={styles.legendText}>Low: {donut.low_stock}</Text>
              <Text style={styles.legendText}>Out: {donut.out_of_stock}</Text>
            </View>
          </View>

          <View style={styles.tableCard}>
            <Text style={styles.cardTitle}>Recent Transactions</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.headCell, styles.colTime]}>Time</Text>
              <Text style={[styles.headCell, styles.colMember]}>Member</Text>
              <Text style={[styles.headCell, styles.colItems]}>Items</Text>
              <Text style={[styles.headCell, styles.colTotal]}>Total</Text>
              <Text style={[styles.headCell, styles.colMethod]}>Method</Text>
            </View>
            {recentTransactions.map((row) => (
              <View key={row.id_sale} style={styles.tableRow}>
                <Text style={[styles.rowCell, styles.colTime]}>
                  {new Date(row.sale_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </Text>
                <Text style={[styles.rowCell, styles.colMember]}>{row.member_name}</Text>
                <Text style={[styles.rowCell, styles.colItems]}>{row.item_count} items</Text>
                <Text style={[styles.rowCell, styles.colTotal, styles.totalText]}>{formatRupiah(row.total_amount)}</Text>
                <Text style={[styles.rowCell, styles.colMethod]}>{row.payment_method}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pageTitle: { fontSize: 30, color: "#0f2852", fontWeight: "800" },
  dateText: { color: "#64748b", fontSize: 13 },
  centerState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { color: "#64748b" },
  errorText: { color: "#dc2626", textAlign: "center", fontWeight: "600" },
  retryButton: { height: 38, borderRadius: 8, backgroundColor: "#2563eb", justifyContent: "center", paddingHorizontal: 14 },
  retryText: { color: "#fff", fontWeight: "700" },
  summaryGrid: { flexDirection: "row", columnGap: 12 },
  summaryCard: { flex: 1, minWidth: 0, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 14, gap: 8 },
  summaryIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryTitle: { color: "#425b7c", fontSize: 12, fontWeight: "600" },
  summaryValue: { color: "#0f2852", fontSize: 22, fontWeight: "800", lineHeight: 28 },
  summaryCaption: { color: "#64748b", fontSize: 12 },
  chartRow: { flexDirection: "row", gap: 12 },
  chartCard: { flex: 1, minWidth: 0, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 16, gap: 12 },
  cardTitle: { color: "#0f2852", fontSize: 17, fontWeight: "700" },
  chartKit: { borderRadius: 10 },
  legendRow: { gap: 6 },
  legendText: { color: "#334155", fontSize: 13 },
  tableCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 16, gap: 8 },
  tableHeader: { height: 42, borderRadius: 8, backgroundColor: "#f1f5fb", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  tableRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: "#eef2f7", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  headCell: { color: "#3c5477", fontWeight: "700", fontSize: 15 },
  rowCell: { color: "#1e3557", fontSize: 14 },
  totalText: { fontWeight: "700" },
  colTime: { width: "16%" },
  colMember: { width: "26%" },
  colItems: { width: "16%" },
  colTotal: { width: "22%" },
  colMethod: { width: "20%" },
});
