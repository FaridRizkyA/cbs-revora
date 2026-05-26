import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BarChart, LineChart, ProgressChart } from "react-native-chart-kit";
import { GraphsResponse } from "./types";

const isWeb = Platform.OS === "web";
let WebLineChart: any = null;
let WebBarChart: any = null;
let WebDoughnutChart: any = null;
let webChartOptions: any = null;

if (isWeb) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactChart = require("react-chartjs-2");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chartJs = require("chart.js");
  chartJs.Chart.register(...chartJs.registerables);

  WebLineChart = reactChart.Line;
  WebBarChart = reactChart.Bar;
  WebDoughnutChart = reactChart.Doughnut;
  webChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
  };
}

type Props = {
  graphs: GraphsResponse | null;
  width: number;
};

export default function DashboardChartsSection({ graphs, width }: Props) {
  const topStockProducts = useMemo(() => (graphs?.pie_graph ?? []).slice(0, 8), [graphs?.pie_graph]);
  const topTransactions = graphs?.bar_graph ?? [];
  const donut = graphs?.donut_graph ?? { safe_stock: 0, low_stock: 0, out_of_stock: 0 };
  const lineRows = graphs?.line_graph ?? [];
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
  const donutData = donutTotal > 0 ? [donut.safe_stock / donutTotal, donut.low_stock / donutTotal, donut.out_of_stock / donutTotal] : [0, 0, 0];
  const stockShareData = topStockProducts.map((item) => Math.max(0, item.percentage / 100));
  const effectiveWidth = width;
  const stackedCharts = effectiveWidth < 860;
  const chartCardWidth = stackedCharts ? effectiveWidth - 32 : (effectiveWidth - 12) / 2 - 32;
  const chartWidth = Math.max(220, Math.floor(chartCardWidth));

  return (
    <>
      <View style={[styles.chartRow, stackedCharts && styles.chartRowStack]}>
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Profit (Last 6 Months)</Text>
          {isWeb ? (
            <View style={styles.webChartWrap}>
              <WebLineChart
                options={webChartOptions}
                data={{
                  labels: lineRows.map((row) => row.month_label),
                  datasets: [
                    {
                      label: "Profit",
                      data: lineRows.map((row) => row.total_profit || 0),
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
          )}
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Transactions (Last 6 Months)</Text>
          {isWeb ? (
            <View style={styles.webChartWrap}>
              <WebLineChart
                options={webChartOptions}
                data={{
                  labels: lineRows.map((row) => row.month_label),
                  datasets: [
                    {
                      label: "Transactions",
                      data: lineRows.map((row) => row.total_transactions || 0),
                      borderColor: "#16a34a",
                      backgroundColor: "rgba(22,163,74,0.2)",
                      tension: 0.35,
                    },
                  ],
                }}
              />
            </View>
          ) : (
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
          )}
        </View>
      </View>

      <View style={[styles.chartRow, stackedCharts && styles.chartRowStack]}>
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Stock Distribution by Product</Text>
          {isWeb ? (
            <View style={styles.webChartWrap}>
              <WebDoughnutChart
                options={webChartOptions}
                data={{
                  labels: topStockProducts.map((item) => item.product_name),
                  datasets: [
                    {
                      data: topStockProducts.map((item) => Math.max(item.percentage, 0)),
                      backgroundColor: ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#0f766e"],
                    },
                  ],
                }}
              />
            </View>
          ) : (
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
              hideLegend
              style={styles.chartKit}
            />
          )}
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
          {isWeb ? (
            <View style={styles.webChartWrap}>
              <WebBarChart
                options={webChartOptions}
                data={{
                  labels: topTransactions.map((item) => item.product_name.slice(0, 8)),
                  datasets: [{ data: topTransactions.map((item) => item.transaction_count || 0), backgroundColor: "#2563eb" }],
                }}
              />
            </View>
          ) : (
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
          )}
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Stock Health (Safe / Low / Out)</Text>
        {isWeb ? (
          <View style={styles.webChartWrap}>
            <WebDoughnutChart
              options={webChartOptions}
              data={{
                labels: ["Safe", "Low", "Out"],
                datasets: [{ data: [donut.safe_stock, donut.low_stock, donut.out_of_stock], backgroundColor: ["#16a34a", "#d97706", "#dc2626"] }],
              }}
            />
          </View>
        ) : (
          <ProgressChart
            data={{ labels: ["Safe", "Low", "Out"], data: donutData }}
            width={chartWidth}
            height={220}
            strokeWidth={20}
            radius={38}
            chartConfig={chartConfig}
            hideLegend
            style={styles.chartKit}
          />
        )}
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Safe: {donut.safe_stock}</Text>
          <Text style={styles.legendText}>Low: {donut.low_stock}</Text>
          <Text style={styles.legendText}>Out: {donut.out_of_stock}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chartRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  chartRowStack: { flexDirection: "column" },
  chartCard: { flex: 1, minWidth: 0, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", padding: 16, gap: 12 },
  cardTitle: { color: "#0f2852", fontSize: 17, fontWeight: "700" },
  chartKit: { borderRadius: 10 },
  webChartWrap: { height: 230 },
  legendRow: { gap: 6 },
  legendText: { color: "#334155", fontSize: 13 },
});
