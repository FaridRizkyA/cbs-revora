import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import DashboardChartsSection from "../../components/dashboard/charts/DashboardChartsSection";
import { GraphsResponse } from "../../components/dashboard/charts/types";
import { fetchWithAuth } from "../../utils/fetchWithAuth";

type SummaryResponse = {
  total_sales: number;
  total_transactions: number;
  today_transactions: number;
  expired_batch_count: number;
  near_expired_batch_count: number;
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
  const [contentWidth, setContentWidth] = useState(0);
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
        fetchWithAuth("/api/dashboard/summaryCard"),
        fetchWithAuth("/api/dashboard/graphs"),
        fetchWithAuth("/api/dashboard/recentTransaction?limit=10"),
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

  const effectiveWidth = contentWidth > 0 ? contentWidth : width - 28;

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
      <View onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
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

            <DashboardChartsSection graphs={graphs} width={effectiveWidth} />

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pageTitle: { fontSize: 30, color: "#0f2852", fontWeight: "800" },
  dateText: { color: "#64748b", fontSize: 13 },
  centerState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { color: "#64748b" },
  errorText: { color: "#dc2626", textAlign: "center", fontWeight: "600" },
  retryButton: { height: 38, borderRadius: 8, backgroundColor: "#2563eb", justifyContent: "center", paddingHorizontal: 14 },
  retryText: { color: "#fff", fontWeight: "700" },
  summaryGrid: { flexDirection: "row", columnGap: 12, rowGap: 12 },
  summaryCard: { flex: 1, minWidth: 0, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 14, gap: 8 },
  summaryIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryTitle: { color: "#425b7c", fontSize: 12, fontWeight: "600" },
  summaryValue: { color: "#0f2852", fontSize: 22, fontWeight: "800", lineHeight: 28 },
  summaryCaption: { color: "#64748b", fontSize: 12 },
  tableCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 16, gap: 8, marginTop: 4 },
  tableHeader: { height: 42, borderRadius: 8, backgroundColor: "#f1f5fb", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  tableRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: "#eef2f7", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  headCell: { color: "#3c5477", fontWeight: "700", fontSize: 15, textAlign: "left" },
  rowCell: { color: "#1e3557", fontSize: 14, textAlign: "left" },
  totalText: { fontWeight: "700" },
  colTime: { width: "16%" },
  colMember: { width: "26%" },
  colItems: { width: "16%" },
  colTotal: { width: "22%" },
  colMethod: { width: "20%" },
});
