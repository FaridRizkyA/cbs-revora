import { Text, View } from "react-native";
import { formatDate, formatRupiah } from "./formatters";
import { styles } from "./styles";
import { ShuPeriod } from "./types";

type Props = {
  period: ShuPeriod;
};

export function ShuPeriodCard({ period }: Props) {
  const statusLabel = period.calculation_status || "DRAFT";
  const statusStyle =
    statusLabel === "FINALIZED"
      ? styles.statusFinalized
      : statusLabel === "CALCULATED"
        ? styles.statusCalculated
        : styles.statusDraft;

  const summaryItems = [
    { label: "Displayed Net Profit", value: formatRupiah(period.gross_profit_display) },
    { label: "SHU (Patronage Refund) Shopping Pool", value: formatRupiah(period.shu_belanja_pool_amount) },
    { label: "SHU (Patronage Refund) Business Pool", value: formatRupiah(period.shu_usaha_pool_amount) },
    { label: "Management Fund", value: formatRupiah(period.total_manager_fund_amount) },
    { label: "Total Member SHU (Patronage Refund)", value: formatRupiah(period.total_shu_distributed_amount) },
    { label: "Reconciliation Gap", value: formatRupiah(period.reconciliation_gap_amount) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.periodHeader}>
        <View>
          <Text style={styles.cardTitle}>{period.period_name || "Active SHU Period"}</Text>
          <Text style={styles.metaText}>
            {formatDate(period.start_date)} s/d {formatDate(period.end_date)}
          </Text>
        </View>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.pathRow}>
        <View style={styles.pathCard}>
          <Text style={styles.pathTitle}>Shopping Path</Text>
          <Text style={styles.pathLine}>Income: {formatRupiah(period.income_belanja_amount)}</Text>
          <Text style={styles.pathLine}>Expense: {formatRupiah(period.expense_belanja_amount)}</Text>
          <Text style={styles.pathLine}>Net: {formatRupiah(period.net_belanja_amount)}</Text>
          <Text style={styles.pathLine}>Management Cut 10%: {formatRupiah(period.manager_cut_belanja_amount)}</Text>
        </View>
        <View style={styles.pathCard}>
          <Text style={styles.pathTitle}>Business Path</Text>
          <Text style={styles.pathLine}>Income: {formatRupiah(period.income_usaha_amount)}</Text>
          <Text style={styles.pathLine}>Expense: {formatRupiah(period.expense_usaha_amount)}</Text>
          <Text style={styles.pathLine}>Net: {formatRupiah(period.net_usaha_amount)}</Text>
          <Text style={styles.pathLine}>Management Cut 10%: {formatRupiah(period.manager_cut_usaha_amount)}</Text>
        </View>
      </View>
    </View>
  );
}
