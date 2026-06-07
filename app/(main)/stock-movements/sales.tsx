import * as Print from "expo-print";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildSalesItemsTableExcelFileName,
  buildSalesItemsTableReportPrintHtml,
  salesItemsTableColumns,
} from "../../../components/reports/sales/SalesItemsReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { logClientActivity } from "../../../utils/activityLog";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { getAuthSession, normalizeRole } from "../../../utils/authSession";
import { downloadExcelWorkbook } from "../../../utils/excelExport";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { printReportHtml } from "../../../utils/printUtils";

type SalesItem = {
  id_sale_item: string;
  id_sale: string;
  sale_code: string;
  stock_out_code: string;
  sale_date: string;
  payment_method?: string | null;
  customer_type?: string | null;
  id_product: string;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  quantity: number;
  sell_per_pcs: number;
  total_sell: number;
  cashier_name?: string | null;
};

type PeriodFilter = "TODAY" | "THIS_MONTH" | "ALL_TIME" | "CUSTOM";

const formatCurrency = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
};

export default function SalesItemsScreen() {
  const [rows, setRows] = useState<SalesItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [productFilter, setProductFilter] = useState("ALL");
  const [draftProductFilter, setDraftProductFilter] = useState("ALL");
  const [cashierFilter, setCashierFilter] = useState("ALL");
  const [draftCashierFilter, setDraftCashierFilter] = useState("ALL");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [draftDateStartFilter, setDraftDateStartFilter] = useState("");
  const [draftDateEndFilter, setDraftDateEndFilter] = useState("");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [maxQtyFilter, setMaxQtyFilter] = useState("");
  const [draftMinQtyFilter, setDraftMinQtyFilter] = useState("");
  const [draftMaxQtyFilter, setDraftMaxQtyFilter] = useState("");
  const [minTotalSellFilter, setMinTotalSellFilter] = useState("");
  const [maxTotalSellFilter, setMaxTotalSellFilter] = useState("");
  const [draftMinTotalSellFilter, setDraftMinTotalSellFilter] = useState("");
  const [draftMaxTotalSellFilter, setDraftMaxTotalSellFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("TODAY");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [roleName, setRoleName] = useState("CASHIER");
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

  const loadRows = () => {
    fetchWithAuth("/api/sales-items")
      .then((response) => response.json())
      .then((payload) => setRows(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    loadRows();
    getAuthSession()
      .then((session) => setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER"))
      .catch(() => setRoleName("CASHIER"));
  }, []);

  const applyPeriodFilter = (period: PeriodFilter) => {
    setPeriodFilter(period);
    if (period === "TODAY") {
      const today = formatDateInput(new Date());
      setDateStartFilter(today);
      setDateEndFilter(today);
      return;
    }
    if (period === "THIS_MONTH") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateStartFilter(formatDateInput(firstDay));
      setDateEndFilter(formatDateInput(now));
      return;
    }
    if (period === "ALL_TIME") {
      setDateStartFilter("");
      setDateEndFilter("");
    }
  };

  useEffect(() => {
    applyPeriodFilter("TODAY");
  }, []);

  const productOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((row) => row.product_name || "-"))).sort()],
    [rows]
  );

  const cashierOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((row) => row.cashier_name || "-"))).sort()],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;
    const minQty = Number(minQtyFilter || "0");
    const maxQty = Number(maxQtyFilter || "0");
    const minTotalSell = Number(minTotalSellFilter || "0");
    const maxTotalSell = Number(maxTotalSellFilter || "0");

    return rows.filter((row) => {
      const rowDate = row.sale_date ? new Date(row.sale_date) : null;
      const matchSearch =
        !query ||
        `${row.sale_code} ${row.stock_out_code} ${row.product_code} ${row.product_name} ${row.batch_code || ""} ${row.cashier_name || ""}`
          .toLowerCase()
          .includes(query);
      const matchProduct = productFilter === "ALL" ? true : row.product_name === productFilter;
      const matchCashier = cashierFilter === "ALL" ? true : (row.cashier_name || "-") === cashierFilter;
      const matchStartDate = startDate && rowDate ? rowDate >= startDate : true;
      const matchEndDate = endDate && rowDate ? rowDate <= endDate : true;
      const matchMinQty = minQtyFilter.trim() ? Number(row.quantity || 0) >= minQty : true;
      const matchMaxQty = maxQtyFilter.trim() ? Number(row.quantity || 0) <= maxQty : true;
      const matchMinTotalSell = minTotalSellFilter.trim() ? Number(row.total_sell || 0) >= minTotalSell : true;
      const matchMaxTotalSell = maxTotalSellFilter.trim() ? Number(row.total_sell || 0) <= maxTotalSell : true;

      return (
        matchSearch &&
        matchProduct &&
        matchCashier &&
        matchStartDate &&
        matchEndDate &&
        matchMinQty &&
        matchMaxQty &&
        matchMinTotalSell &&
        matchMaxTotalSell
      );
    });
  }, [rows, search, productFilter, cashierFilter, dateStartFilter, dateEndFilter, minQtyFilter, maxQtyFilter, minTotalSellFilter, maxTotalSellFilter]);

  const summary = useMemo(() => {
    const transactionIds = new Set(filteredRows.map((row) => row.id_sale));
    const totalTransactions = transactionIds.size;
    const totalQty = filteredRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalIncome = filteredRows.reduce((sum, row) => sum + Number(row.total_sell || 0), 0);
    const averagePerTransaction = totalTransactions > 0 ? totalIncome / totalTransactions : 0;
    return { totalTransactions, totalQty, totalIncome, averagePerTransaction };
  }, [filteredRows]);

  const periodLabel =
    periodFilter === "TODAY"
      ? "Today"
      : periodFilter === "THIS_MONTH"
        ? "This Month"
        : periodFilter === "ALL_TIME"
          ? "All Time"
          : "Custom";

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (cashierFilter !== "ALL") items.push({ key: "cashier", label: "Cashier", value: cashierFilter, onClear: () => setCashierFilter("ALL") });
    if (periodFilter === "CUSTOM" && dateStartFilter) items.push({ key: "startDate", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (periodFilter === "CUSTOM" && dateEndFilter) items.push({ key: "endDate", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minQtyFilter, onClear: () => setMinQtyFilter("") });
    if (maxQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxQtyFilter, onClear: () => setMaxQtyFilter("") });
    if (minTotalSellFilter) items.push({ key: "minTotalSell", label: "Min Total Sell", value: formatCurrency(Number(minTotalSellFilter)), onClear: () => setMinTotalSellFilter("") });
    if (maxTotalSellFilter) items.push({ key: "maxTotalSell", label: "Max Total Sell", value: formatCurrency(Number(maxTotalSellFilter)), onClear: () => setMaxTotalSellFilter("") });
    return items;
  }, [productFilter, cashierFilter, dateStartFilter, dateEndFilter, minQtyFilter, maxQtyFilter, minTotalSellFilter, maxTotalSellFilter, periodFilter]);

  const tableColumns = useMemo<InventoryDataTableColumn<SalesItem>[]>(() => [
    { key: "sale_code", title: "Sale Code", weight: 22, sortable: true, sortValue: (row) => row.sale_code || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.sale_code}</Text> },
    { key: "product_name", title: "Product", weight: 23, sortable: true, sortValue: (row) => row.product_name || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.product_name}</Text> },
    { key: "quantity", title: "Qty", weight: 7, align: "center", sortable: true, sortValue: (row) => Number(row.quantity || 0), render: (row) => <Text style={styles.rowCell}>{row.quantity}</Text> },
    { key: "sell_per_pcs", title: "Price", weight: 13, sortable: true, sortValue: (row) => Number(row.sell_per_pcs || 0), render: (row) => <Text style={styles.rowCell}>{formatCurrency(Number(row.sell_per_pcs || 0))}</Text> },
    { key: "total_sell", title: "Total Sell", weight: 14, sortable: true, sortValue: (row) => Number(row.total_sell || 0), render: (row) => <Text style={styles.rowCell}>{formatCurrency(Number(row.total_sell || 0))}</Text> },
    { key: "cashier_name", title: "Cashier", weight: 12, sortable: true, sortValue: (row) => row.cashier_name || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.cashier_name || "-"}</Text> },
    { key: "sale_date", title: "Date", weight: 15, sortable: true, sortValue: (row) => new Date(row.sale_date).getTime(), render: (row) => <Text style={styles.rowCell}>{formatDateTime(row.sale_date)}</Text> },
  ], []);

  const buildCurrentSalesItemsReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    items.push({ label: "Period", value: periodLabel });
    if (productFilter !== "ALL") items.push({ label: "Product Filter", value: productFilter });
    if (cashierFilter !== "ALL") items.push({ label: "Cashier Filter", value: cashierFilter });
    if (dateStartFilter) items.push({ label: "Start Date", value: dateStartFilter });
    if (dateEndFilter) items.push({ label: "End Date", value: dateEndFilter });
    if (minQtyFilter.trim()) items.push({ label: "Min Qty", value: minQtyFilter });
    if (maxQtyFilter.trim()) items.push({ label: "Max Qty", value: maxQtyFilter });
    if (minTotalSellFilter.trim()) items.push({ label: "Min Total Sell", value: formatCurrency(Number(minTotalSellFilter)) });
    if (maxTotalSellFilter.trim()) items.push({ label: "Max Total Sell", value: formatCurrency(Number(maxTotalSellFilter)) });
    items.push({ label: "Items Sold", value: summary.totalQty });
    items.push({ label: "Sales Income", value: formatCurrency(summary.totalIncome) });
    return items;
  };

  const handlePrintSalesItemsTable = async () => {
    try {
      const html = buildSalesItemsTableReportPrintHtml({
        rows: filteredRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentSalesItemsReportMeta(),
      });
      await printReportHtml(html, {
        tableName: "tbl_sale_items",
        description: "Printed sales items report.",
        fileName: buildReportPdfFileName({ reportKey: "inventory-sales-items", variant: "table", date: new Date() }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print sales items report.");
    }
  };

  const handleExportSalesItemsExcel = async () => {
    try {
      const generatedAt = new Date();
      await downloadExcelWorkbook({
        title: "Sales Items Report",
        subtitle: "Sold products from sales transactions",
        reportKey: "inventory-sales-items",
        rows: filteredRows,
        columns: [
          { key: "row_number", title: "No.", width: 8, align: "center", getValue: (_row, index) => index + 1 },
          { key: "sale_code", title: "Sale Code", width: 22, getValue: (row) => row.sale_code },
          { key: "product_name", title: "Product", width: 30, getValue: (row) => row.product_name },
          { key: "quantity", title: "Qty", width: 10, align: "center", getValue: (row) => Number(row.quantity || 0) },
          { key: "sell_per_pcs", title: "Price", width: 16, align: "right", getValue: (row) => Number(row.sell_per_pcs || 0) },
          { key: "total_sell", title: "Total Sell", width: 18, align: "right", getValue: (row) => Number(row.total_sell || 0) },
          { key: "cashier_name", title: "Cashier", width: 20, getValue: (row) => row.cashier_name || "-" },
          { key: "sale_date", title: "Date", width: 20, getValue: (row) => formatDateTime(row.sale_date) },
        ],
        generatedAt,
        generatedBy: roleName,
        meta: buildCurrentSalesItemsReportMeta(),
        fileName: buildSalesItemsTableExcelFileName(generatedAt),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_sale_items",
        description: "Exported sales items report as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export sales items as Excel.");
    }
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const generatedAt = new Date();
      const printHtml = buildSalesItemsTableReportPrintHtml({
        rows: filteredRows,
        generatedAt,
        generatedBy: roleName,
        meta: buildCurrentSalesItemsReportMeta(),
      });
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: "Sales Items Report",
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: "Sales Items Report",
        subtitle: "Sold products from sales transactions",
        generated_by: roleName,
        print_html: printHtml,
        meta: buildCurrentSalesItemsReportMeta(),
        columns: salesItemsTableColumns.map((c) => ({ key: c.key, title: c.title, align: c.align })),
        rows: filteredRows.map((row, idx) => {
          const rowData: any = {};
          salesItemsTableColumns.forEach((c) => {
            rowData[c.key] = c.getValue(row, idx);
          });
          return rowData;
        }),
      };

      const response = await fetchWithAuth("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_sale_items",
        description: "Sent sales items report via email.",
      });

      setResultStatus("success");
      setResultTitle("Email Sent");
      setResultMessage("Report has been sent successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Send Failed");
      setResultMessage(error instanceof Error ? error.message : "An error occurred.");
      setResultModalOpen(true);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <InventoryPageHeader
          title="Sales Items"
          subtitle="View sold products from sales transactions per item."
          action={
            <ExportDropdownMenu
              onExportPdf={handlePrintSalesItemsTable}
              onExportExcel={handleExportSalesItemsExcel}
              onSendEmail={() => setEmailModalOpen(true)}
            />
          }
        />

        <View style={styles.periodCard}>
          <View style={styles.periodChipRow}>
            {[
              { key: "TODAY", label: "Today" },
              { key: "THIS_MONTH", label: "This Month" },
              { key: "ALL_TIME", label: "All Time" },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.periodChip, periodFilter === item.key && styles.periodChipActive]}
                onPress={() => applyPeriodFilter(item.key as PeriodFilter)}
              >
                <Text style={[styles.periodChipText, periodFilter === item.key && styles.periodChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            {periodFilter === "CUSTOM" ? (
              <View style={[styles.periodChip, styles.periodChipCustom]}>
                <Text style={[styles.periodChipText, styles.periodChipCustomText]}>Custom</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Transactions {periodLabel}</Text>
              <Text style={styles.summaryValue}>{summary.totalTransactions.toLocaleString("id-ID")}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Items Sold {periodLabel}</Text>
              <Text style={styles.summaryValue}>{summary.totalQty.toLocaleString("id-ID")}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Sales Income {periodLabel}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalIncome)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg / Transaction</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.averagePerTransaction)}</Text>
            </View>
          </View>
        </View>

        <InventoryFilterSection
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search sale code, product, batch, or cashier"
          onOpenFilter={() => {
            setDraftProductFilter(productFilter);
            setDraftCashierFilter(cashierFilter);
            setDraftDateStartFilter(dateStartFilter);
            setDraftDateEndFilter(dateEndFilter);
            setDraftMinQtyFilter(minQtyFilter);
            setDraftMaxQtyFilter(maxQtyFilter);
            setDraftMinTotalSellFilter(minTotalSellFilter);
            setDraftMaxTotalSellFilter(maxTotalSellFilter);
            setFilterOpen(true);
          }}
          activeFilters={activeFilters}
          onClearAllFilters={() => {
            setProductFilter("ALL");
            setCashierFilter("ALL");
            applyPeriodFilter("TODAY");
            setMinQtyFilter("");
            setMaxQtyFilter("");
            setMinTotalSellFilter("");
            setMaxTotalSellFilter("");
          }}
        />

        <InventoryDataTable
          columns={tableColumns}
          rows={filteredRows}
          rowKey={(row) => row.id_sale_item}
          emptyText="No sales items found."
        />
      </ScrollView>

      <FilterSheetModal
        title="Filter Sales Items"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            showResult("error", "Validation", "End date must be the same as or after Start date.");
            return;
          }
          setProductFilter(draftProductFilter);
          setCashierFilter(draftCashierFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setPeriodFilter("CUSTOM");
          setMinQtyFilter(draftMinQtyFilter);
          setMaxQtyFilter(draftMaxQtyFilter);
          setMinTotalSellFilter(draftMinTotalSellFilter);
          setMaxTotalSellFilter(draftMaxTotalSellFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftProductFilter("ALL");
          setProductFilter("ALL");
          setDraftCashierFilter("ALL");
          setCashierFilter("ALL");
          setDraftDateStartFilter("");
          setDraftDateEndFilter("");
          applyPeriodFilter("TODAY");
          setDraftMinQtyFilter("");
          setMinQtyFilter("");
          setDraftMaxQtyFilter("");
          setMaxQtyFilter("");
          setDraftMinTotalSellFilter("");
          setMinTotalSellFilter("");
          setDraftMaxTotalSellFilter("");
          setMaxTotalSellFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Product"
          value={draftProductFilter}
          options={productOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftProductFilter}
        />
        <FilterSelectField
          label="Cashier"
          value={draftCashierFilter}
          options={cashierOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftCashierFilter}
        />
        <Text style={styles.filterLabel}>Sales Date Range</Text>
        <View style={styles.rangeRow}>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="Start Date"
              value={draftDateStartFilter}
              placeholder="Select start date"
              onChange={setDraftDateStartFilter}
              maximumDate={draftDateEndFilter ? new Date(`${draftDateEndFilter}T00:00:00`) : undefined}
            />
          </View>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="End Date"
              value={draftDateEndFilter}
              placeholder="Select end date"
              onChange={setDraftDateEndFilter}
              minimumDate={draftDateStartFilter ? new Date(`${draftDateStartFilter}T00:00:00`) : undefined}
            />
          </View>
        </View>
        <Text style={styles.filterLabel}>Qty Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinQtyFilter} onChangeText={(value) => setDraftMinQtyFilter(value.replace(/[^0-9]/g, ""))} placeholder="Min qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxQtyFilter} onChangeText={(value) => setDraftMaxQtyFilter(value.replace(/[^0-9]/g, ""))} placeholder="Max qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
        <Text style={styles.filterLabel}>Total Sell Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinTotalSellFilter} onChangeText={(value) => setDraftMinTotalSellFilter(value.replace(/[^0-9]/g, ""))} placeholder="Min total" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxTotalSellFilter} onChangeText={(value) => setDraftMaxTotalSellFilter(value.replace(/[^0-9]/g, ""))} placeholder="Max total" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
      </FilterSheetModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle="Sales Items"
        onSend={handleSendEmailReport}
      />
      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  container: { flex: 1 },
  content: { padding: 14, gap: 12 },
  periodCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12, gap: 12 },
  periodChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodChip: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  periodChipCustom: { borderColor: "#1d4ed8", backgroundColor: "#1d4ed8" },
  periodChipText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  periodChipTextActive: { color: "#1d4ed8" },
  periodChipCustomText: { color: "#ffffff" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flex: 1, minWidth: 180, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 12, gap: 6 },
  summaryLabel: { color: "#64748b", fontSize: 11, fontWeight: "800" },
  summaryValue: { color: "#0f2852", fontSize: 20, fontWeight: "900" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, color: "#0f172a" },
});
