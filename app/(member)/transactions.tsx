import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { InventoryResultModal } from "../../components/inventory/ActionModals";
import MemberShell from "../../components/member/MemberShell";
import InventoryDataTable, { InventoryDataTableColumn } from "../../components/inventory/InventoryDataTable";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import { buildReceiptPrintHtml } from "../../components/cashier/ReceiptPrintTemplate";
import { buildMemberTransactionsReportPrintHtml, MemberTransactionReportRow } from "../../components/reports/member/MemberTransactionsReportPrintTemplate";
import { formatDateTime, formatRupiah } from "../../components/shu/formatters";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { AuthSession, getAuthSession } from "../../utils/authSession";
import { logClientActivity } from "../../utils/activityLog";
import { useRouter } from "expo-router";

type MemberOverview = {
  member: {
    member_code?: string | null;
  };
  metrics: {
    total_transactions?: number;
    total_spending?: number;
    last_transaction_date?: string | null;
  };
};

type TransactionDetail = MemberTransactionReportRow & {
  member_code?: string | null;
  member_name?: string | null;
  member_email?: string | null;
  items?: {
    id_sale_item?: string;
    product_code?: string | null;
    product_name?: string | null;
    quantity?: number;
    unit_price?: number;
    subtotal?: number;
  }[];
};

type RangeKey = "DAILY" | "WEEKLY" | "MONTHLY" | "ALL";
type ViewMode = "TRANSACTION" | "ITEM";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "ALL", label: "All Time" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const printHtml = async (html: string, activityType: "PRINT_REPORT" | "PRINT_RECEIPT", description: string) => {
  await logClientActivity({ activityType, description });

  if (Platform.OS !== "web") {
    await Print.printAsync({ html });
    return;
  }

  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "width=1024,height=720");
  if (!printWindow) {
    throw new Error("Please allow pop-ups to print this document.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
};

export default function MemberTransactionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [range, setRange] = useState<RangeKey>("MONTHLY");
  const [viewMode, setViewMode] = useState<ViewMode>("TRANSACTION");
  const [overview, setOverview] = useState<MemberOverview | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<MemberTransactionReportRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const showError = (title: string, message: string) => {
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  };

  const loadTransactions = useCallback(async (nextRange: RangeKey) => {
    setLoading(true);
    try {
      const [overviewResponse, transactionResponse] = await Promise.all([
        fetchWithAuth("/api/member/overview"),
        fetchWithAuth(`/api/member/transactions?range=${encodeURIComponent(nextRange)}`),
      ]);

      const overviewPayload = await overviewResponse.json();
      const transactionPayload = await transactionResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(overviewPayload?.message || "Failed to load member overview.");
      }
      if (!transactionResponse.ok) {
        throw new Error(transactionPayload?.message || "Failed to load transactions.");
      }

      setOverview(overviewPayload?.data || null);
      setRows(Array.isArray(transactionPayload?.data) ? transactionPayload.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAuthSession().then(s => setSession(s));
    loadTransactions(range).catch((error) => {
      showError("Error", error instanceof Error ? error.message : "Failed to load transactions.");
    });
  }, [loadTransactions, range]);

  const loadDetail = useCallback(async (idSale: string) => {
    setDetailLoading(true);
    try {
      const response = await fetchWithAuth(`/api/member/transactions/${idSale}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load transaction detail.");
      }
      setSelectedRow(payload?.data || null);
      setDetailOpen(true);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "Failed to load transaction detail.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const printTransactionsReport = async () => {
    if (!overview) return;
    try {
      setPrinting(true);
      const html = buildMemberTransactionsReportPrintHtml({
        memberName: session?.user?.full_name || "Member",
        memberCode: overview.member.member_code || "-",
        rangeLabel: RANGE_OPTIONS.find((item) => item.key === range)?.label || "All Time",
        generatedAt: new Date(),
        rows,
      });
      await printHtml(html, "PRINT_REPORT", "Printed member spending detail report.");
    } catch (error) {
      showError("Print Failed", error instanceof Error ? error.message : "Failed to print spending detail.");
    } finally {
      setPrinting(false);
    }
  };

  const printReceipt = async () => {
    if (!selectedRow) return;

    try {
      setPrinting(true);
      const html = buildReceiptPrintHtml({
        saleNumber: selectedRow.sale_number,
        saleDate: selectedRow.sale_date,
        cashierName: selectedRow.cashier_name || "-",
        member: {
          code: selectedRow.member_code || overview?.member?.member_code || "-",
          name: selectedRow.member_name || "Member",
        },
        paymentMethod: (selectedRow.payment_method as "CASH" | "QRIS") || "CASH",
        amountPaid: Number(selectedRow.amount_paid || 0),
        changeAmount: Number(selectedRow.change_amount || 0),
        discountAmount: Number(selectedRow.discount_amount || 0),
        notes: selectedRow.notes || null,
        items: (selectedRow.items || []).map((item) => ({
          productCode: item.product_code ?? null,
          productName: String(item.product_name || "-"),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          lineTotal: Number(item.subtotal || Number(item.quantity || 0) * Number(item.unit_price || 0)),
        })),
      });
      await printHtml(html, "PRINT_RECEIPT", `Printed sale receipt ${selectedRow.sale_number}.`);
    } catch (error) {
      showError("Print Failed", error instanceof Error ? error.message : "Failed to print receipt.");
    } finally {
      setPrinting(false);
    }
  };

  const columns = useMemo<InventoryDataTableColumn<MemberTransactionReportRow>[]>(() => [
    {
      key: "sale_number",
      title: "Transaction No.",
      weight: 18,
      sortable: true,
      sortValue: (row) => row.sale_number,
      render: (row) => <Text style={styles.cellText}>{row.sale_number}</Text>,
    },
    {
      key: "sale_date",
      title: "Date",
      weight: 16,
      sortable: true,
      sortValue: (row) => row.sale_date,
      render: (row) => <Text style={styles.cellText}>{formatDateTime(row.sale_date)}</Text>,
    },
    {
      key: "cashier",
      title: "Cashier",
      weight: 18,
      sortable: true,
      sortValue: (row) => row.cashier_name || "",
      render: (row) => <Text style={styles.cellText}>{row.cashier_name || "-"}</Text>,
    },
    {
      key: "payment_method",
      title: "Payment",
      weight: 12,
      align: "center",
      sortable: true,
      sortValue: (row) => row.payment_method,
      render: (row) => <Text style={styles.cellText}>{row.payment_method}</Text>,
    },
    {
      key: "items",
      title: "Items",
      weight: 10,
      align: "right",
      sortable: true,
      sortValue: (row) => row.item_count || 0,
      render: (row) => <Text style={styles.cellText}>{String(row.item_count || row.items?.length || 0)}</Text>,
    },
    {
      key: "total_amount",
      title: "Total",
      weight: 14,
      align: "right",
      sortable: true,
      sortValue: (row) => row.total_amount || 0,
      render: (row) => <Text style={styles.cellText}>{formatRupiah(Number(row.total_amount || 0))}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 12,
      align: "center",
      render: (row) => (
        <Pressable style={styles.detailButton} onPress={() => loadDetail(row.id_sale)}>
          <Text style={styles.detailButtonText}>Details</Text>
        </Pressable>
      ),
    },
  ], [loadDetail]);

  const itemColumns = useMemo<InventoryDataTableColumn<any>[]>(() => [
    {
      key: "date",
      title: "Date",
      weight: 14,
      render: (row) => <Text style={styles.cellText}>{formatDateTime(row.sale_date)}</Text>,
    },
    {
      key: "product",
      title: "Product",
      weight: 35,
      render: (row) => (
        <View>
          <Text style={[styles.cellText, { fontWeight: "700" }]}>{row.product_name}</Text>
          <Text style={[styles.cellText, { fontSize: 10, color: "#64748b" }]}>{row.product_code}</Text>
        </View>
      ),
    },
    {
      key: "qty",
      title: "Qty",
      weight: 10,
      align: "right",
      render: (row) => <Text style={styles.cellText}>{row.quantity}</Text>,
    },
    {
      key: "price",
      title: "Unit Price",
      weight: 18,
      align: "right",
      render: (row) => <Text style={styles.cellText}>{formatRupiah(row.unit_price)}</Text>,
    },
    {
      key: "subtotal",
      title: "Subtotal",
      weight: 23,
      align: "right",
      render: (row) => <Text style={[styles.cellText, { fontWeight: "800" }]}>{formatRupiah(row.subtotal)}</Text>,
    },
  ], []);

  const flattenedItems = useMemo(() => {
    const items: any[] = [];
    rows.forEach((row) => {
      if (Array.isArray(row.items)) {
        row.items.forEach((item) => {
          items.push({
            ...item,
            sale_date: row.sale_date,
            sale_number: row.sale_number,
            payment_method: row.payment_method,
          });
        });
      }
    });
    return items;
  }, [rows]);

  const totalSpending = overview?.metrics?.total_spending || rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

  return (
    <MemberShell
      title="Spending Detail"
      subtitle="Browse daily, weekly, monthly, or all-time spending history."
      active="transactions"
      onNavigate={(key) => router.push(`/(member)/${key}` as never)}
      rightAction={
        <Pressable style={styles.printButton} onPress={printTransactionsReport} disabled={printing || rows.length === 0}>
          <Feather name="printer" size={14} color="#1d4ed8" />
          <Text style={styles.printButtonText}>{printing ? "Printing..." : "Print Detail"}</Text>
        </Pressable>
      }
    >
      <View style={styles.summaryRow}>
        <Metric label="Total Transactions" value={String(rows.length)} />
        <Metric label="Total Items" value={String(flattenedItems.length)} />
        <Metric label="Total Spending" value={formatRupiah(totalSpending)} />
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {RANGE_OPTIONS.map((item) => {
            const active = item.key === range;
            return (
              <Pressable key={item.key} style={[styles.filterButton, active && styles.filterButtonActive]} onPress={() => setRange(item.key)}>
                <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.viewToggle}>
          <Pressable style={[styles.toggleBtn, viewMode === "TRANSACTION" && styles.toggleBtnActive]} onPress={() => setViewMode("TRANSACTION")}>
            <Feather name="list" size={14} color={viewMode === "TRANSACTION" ? "#fff" : "#64748b"} />
            <Text style={[styles.toggleText, viewMode === "TRANSACTION" && styles.toggleTextActive]}>Transactions</Text>
          </Pressable>
          <Pressable style={[styles.toggleBtn, viewMode === "ITEM" && styles.toggleBtnActive]} onPress={() => setViewMode("ITEM")}>
            <Feather name="box" size={14} color={viewMode === "ITEM" ? "#fff" : "#64748b"} />
            <Text style={[styles.toggleText, viewMode === "ITEM" && styles.toggleTextActive]}>Items</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        {loading ? (
          <Text style={styles.stateText}>Loading spending history...</Text>
        ) : viewMode === "TRANSACTION" ? (
          <InventoryDataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id_sale}
            emptyText="No spending history found for this period."
          />
        ) : (
          <InventoryDataTable
            columns={itemColumns}
            rows={flattenedItems}
            rowKey={(row, idx) => `${row.id_sale_item}-${idx}`}
            emptyText="No items found for this period."
          />
        )}
      </View>

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
          <Text style={styles.modalTitle}>Transaction Detail</Text>
          <View style={styles.modalActionRow}>
            <Pressable style={styles.modalSecondaryButton} onPress={printReceipt} disabled={printing || detailLoading || !selectedRow}>
              <Feather name="printer" size={14} color="#1d4ed8" />
              <Text style={styles.modalSecondaryButtonText}>{printing ? "Printing..." : "Print Receipt"}</Text>
            </Pressable>
          </View>
        </View>

        {detailLoading ? <Text style={styles.stateText}>Loading detail...</Text> : null}

        {selectedRow ? (
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailGrid}>
              <Detail label="Transaction No." value={selectedRow.sale_number} />
              <Detail label="Date" value={formatDateTime(selectedRow.sale_date)} />
              <Detail label="Cashier" value={selectedRow.cashier_name || "-"} />
              <Detail label="Payment" value={selectedRow.payment_method} />
              <Detail label="Subtotal" value={formatRupiah(Number(selectedRow.subtotal || 0))} />
              <Detail label="Discount" value={formatRupiah(Number(selectedRow.discount_amount || 0))} />
              <Detail label="Total" value={formatRupiah(Number(selectedRow.total_amount || 0))} />
              <Detail label="Paid" value={formatRupiah(Number(selectedRow.amount_paid || 0))} />
              <Detail label="Change" value={formatRupiah(Number(selectedRow.change_amount || 0))} />
              <Detail label="Notes" value={selectedRow.notes || "-"} full />
            </View>

            <View style={styles.itemsBlock}>
              <Text style={styles.sectionTitle}>Items</Text>
              <View style={styles.itemsList}>
                {(selectedRow.items || []).map((item, index) => (
                  <View key={`${index}`} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemName}>{item.product_name || "-"}</Text>
                      <Text style={styles.itemMeta}>
                        {String(item.quantity || 0)} x {formatRupiah(Number(item.unit_price || 0))}
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatRupiah(Number(item.subtotal || 0))}</Text>
                  </View>
                ))}
              </View>
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
        status="error"
        title={resultTitle}
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

function Detail({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <View style={[styles.detailCard, full && styles.detailCardFull]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    flexBasis: "32%",
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
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: "#1d4ed8",
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  toggleTextActive: {
    color: "#fff",
  },
  filterButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  filterButtonText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  filterButtonTextActive: { color: "#1d4ed8" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  cellText: { color: "#0f172a", fontSize: 12 },
  detailButton: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailButtonText: { color: "#1d4ed8", fontSize: 11, fontWeight: "800" },
  printButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  printButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  modalCard: {
    width: "100%",
    maxWidth: 1040,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  modalTitle: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  modalActionRow: { flexDirection: "row", gap: 8 },
  modalSecondaryButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalSecondaryButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  stateText: { color: "#64748b", fontSize: 12 },
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
  itemsBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    padding: 12,
    gap: 10,
  },
  sectionTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  itemsList: { gap: 8 },
  itemRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemLeft: { flex: 1, gap: 3 },
  itemName: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  itemMeta: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  itemTotal: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
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
