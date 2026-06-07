import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DatePickerField from "../../../components/inventory/DatePickerField";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import { InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildSalesCostTableReportPrintHtml,
  downloadSalesCostTableReportExcel,
  salesCostTableColumns,
} from "../../../components/reports/sales/SalesCostReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { logClientActivity } from "../../../utils/activityLog";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { getAuthSession, normalizeRole } from "../../../utils/authSession";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { printReportHtml } from "../../../utils/printUtils";

type SalesCost = {
  id_stock_in_item: string;
  id_stock_in: string;
  stock_in_code: string;
  stock_in_date: string;
  id_product: string;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  supplier_name?: string | null;
  quantity: number;
  buy_per_pcs: number;
  total_cost: number;
  received_by_name?: string | null;
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

export default function SalesCostScreen() {
  const [rows, setRows] = useState<SalesCost[]>([]);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [productFilter, setProductFilter] = useState("ALL");
  const [draftProductFilter, setDraftProductFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [draftSupplierFilter, setDraftSupplierFilter] = useState("ALL");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [draftDateStartFilter, setDraftDateStartFilter] = useState("");
  const [draftDateEndFilter, setDraftDateEndFilter] = useState("");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [maxQtyFilter, setMaxQtyFilter] = useState("");
  const [draftMinQtyFilter, setDraftMinQtyFilter] = useState("");
  const [draftMaxQtyFilter, setDraftMaxQtyFilter] = useState("");
  const [minTotalCostFilter, setMinTotalCostFilter] = useState("");
  const [maxTotalCostFilter, setMaxTotalCostFilter] = useState("");
  const [draftMinTotalCostFilter, setDraftMinTotalCostFilter] = useState("");
  const [draftMaxTotalCostFilter, setDraftMaxTotalCostFilter] = useState("");
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
    fetchWithAuth("/api/sales-costs")
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
      setDateStartFilter(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
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

  const supplierOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((row) => row.supplier_name || "-"))).sort()],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;
    const minQty = Number(minQtyFilter || "0");
    const maxQty = Number(maxQtyFilter || "0");
    const minTotalCost = Number(minTotalCostFilter || "0");
    const maxTotalCost = Number(maxTotalCostFilter || "0");

    return rows.filter((row) => {
      const rowDate = row.stock_in_date ? new Date(row.stock_in_date) : null;
      const matchSearch =
        !query ||
        `${row.stock_in_code} ${row.product_code} ${row.product_name} ${row.batch_code || ""} ${row.supplier_name || ""} ${row.received_by_name || ""}`
          .toLowerCase()
          .includes(query);
      const matchProduct = productFilter === "ALL" ? true : row.product_name === productFilter;
      const matchSupplier = supplierFilter === "ALL" ? true : (row.supplier_name || "-") === supplierFilter;
      const matchStartDate = startDate && rowDate ? rowDate >= startDate : true;
      const matchEndDate = endDate && rowDate ? rowDate <= endDate : true;
      const matchMinQty = minQtyFilter.trim() ? Number(row.quantity || 0) >= minQty : true;
      const matchMaxQty = maxQtyFilter.trim() ? Number(row.quantity || 0) <= maxQty : true;
      const matchMinTotalCost = minTotalCostFilter.trim() ? Number(row.total_cost || 0) >= minTotalCost : true;
      const matchMaxTotalCost = maxTotalCostFilter.trim() ? Number(row.total_cost || 0) <= maxTotalCost : true;

      return (
        matchSearch &&
        matchProduct &&
        matchSupplier &&
        matchStartDate &&
        matchEndDate &&
        matchMinQty &&
        matchMaxQty &&
        matchMinTotalCost &&
        matchMaxTotalCost
      );
    });
  }, [rows, search, productFilter, supplierFilter, dateStartFilter, dateEndFilter, minQtyFilter, maxQtyFilter, minTotalCostFilter, maxTotalCostFilter]);

  const summary = useMemo(() => {
    const stockInIds = new Set(filteredRows.map((row) => row.id_stock_in));
    const totalStockIn = stockInIds.size;
    const totalQty = filteredRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalCost = filteredRows.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    const averagePerStockIn = totalStockIn > 0 ? totalCost / totalStockIn : 0;
    return { totalStockIn, totalQty, totalCost, averagePerStockIn };
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
    if (supplierFilter !== "ALL") items.push({ key: "supplier", label: "Supplier", value: supplierFilter, onClear: () => setSupplierFilter("ALL") });
    if (periodFilter === "CUSTOM" && dateStartFilter) items.push({ key: "startDate", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (periodFilter === "CUSTOM" && dateEndFilter) items.push({ key: "endDate", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minQtyFilter, onClear: () => setMinQtyFilter("") });
    if (maxQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxQtyFilter, onClear: () => setMaxQtyFilter("") });
    if (minTotalCostFilter) items.push({ key: "minTotalCost", label: "Min Total Cost", value: formatCurrency(Number(minTotalCostFilter)), onClear: () => setMinTotalCostFilter("") });
    if (maxTotalCostFilter) items.push({ key: "maxTotalCost", label: "Max Total Cost", value: formatCurrency(Number(maxTotalCostFilter)), onClear: () => setMaxTotalCostFilter("") });
    return items;
  }, [productFilter, supplierFilter, dateStartFilter, dateEndFilter, minQtyFilter, maxQtyFilter, minTotalCostFilter, maxTotalCostFilter, periodFilter]);

  const tableColumns = useMemo<InventoryDataTableColumn<SalesCost>[]>(() => [
    { key: "stock_in_code", title: "Stock In Code", weight: 22, sortable: true, sortValue: (row) => row.stock_in_code || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.stock_in_code}</Text> },
    { key: "product_name", title: "Product", weight: 23, sortable: true, sortValue: (row) => row.product_name || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.product_name}</Text> },
    { key: "quantity", title: "Qty", weight: 7, align: "center", sortable: true, sortValue: (row) => Number(row.quantity || 0), render: (row) => <Text style={styles.rowCell}>{row.quantity}</Text> },
    { key: "buy_per_pcs", title: "Buy/Pcs", weight: 13, sortable: true, sortValue: (row) => Number(row.buy_per_pcs || 0), render: (row) => <Text style={styles.rowCell}>{formatCurrency(Number(row.buy_per_pcs || 0))}</Text> },
    { key: "total_cost", title: "Total Cost", weight: 14, sortable: true, sortValue: (row) => Number(row.total_cost || 0), render: (row) => <Text style={styles.rowCell}>{formatCurrency(Number(row.total_cost || 0))}</Text> },
    { key: "supplier_name", title: "Supplier", weight: 14, sortable: true, sortValue: (row) => row.supplier_name || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.supplier_name || "-"}</Text> },
    { key: "stock_in_date", title: "Date", weight: 15, sortable: true, sortValue: (row) => new Date(row.stock_in_date).getTime(), render: (row) => <Text style={styles.rowCell}>{formatDateTime(row.stock_in_date)}</Text> },
  ], []);

  const buildCurrentSalesCostReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    items.push({ label: "Period", value: periodLabel });
    if (productFilter !== "ALL") items.push({ label: "Product Filter", value: productFilter });
    if (supplierFilter !== "ALL") items.push({ label: "Supplier Filter", value: supplierFilter });
    if (dateStartFilter) items.push({ label: "Start Date", value: dateStartFilter });
    if (dateEndFilter) items.push({ label: "End Date", value: dateEndFilter });
    if (minQtyFilter.trim()) items.push({ label: "Min Qty", value: minQtyFilter });
    if (maxQtyFilter.trim()) items.push({ label: "Max Qty", value: maxQtyFilter });
    if (minTotalCostFilter.trim()) items.push({ label: "Min Total Cost", value: formatCurrency(Number(minTotalCostFilter)) });
    if (maxTotalCostFilter.trim()) items.push({ label: "Max Total Cost", value: formatCurrency(Number(maxTotalCostFilter)) });
    items.push({ label: "Items Purchased", value: summary.totalQty });
    items.push({ label: "Sales Cost", value: formatCurrency(summary.totalCost) });
    return items;
  };

  const handlePrintSalesCostTable = async () => {
    try {
      const html = buildSalesCostTableReportPrintHtml({
        rows: filteredRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentSalesCostReportMeta(),
      });
      await printReportHtml(html, {
        tableName: "tbl_stock_in_items",
        description: "Printed sales cost report.",
        fileName: buildReportPdfFileName({ reportKey: "sales-cost", variant: "table", date: new Date() }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print sales cost report.");
    }
  };

  const handleExportSalesCostExcel = async () => {
    try {
      await downloadSalesCostTableReportExcel({
        rows: filteredRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentSalesCostReportMeta(),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_stock_in_items",
        description: "Exported sales cost report as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export sales cost report.");
    }
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const generatedAt = new Date();
      const printHtml = buildSalesCostTableReportPrintHtml({
        rows: filteredRows,
        generatedAt,
        generatedBy: roleName,
        meta: buildCurrentSalesCostReportMeta(),
      });
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: "Sales Cost Report",
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: "Sales Cost Report",
        subtitle: "Stock purchase costs from stock-in items",
        generated_by: roleName,
        print_html: printHtml,
        meta: buildCurrentSalesCostReportMeta(),
        columns: salesCostTableColumns.map((c) => ({ key: c.key, title: c.title, align: c.align })),
        rows: filteredRows.map((row, idx) => {
          const rowData: any = {};
          salesCostTableColumns.forEach((c) => {
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
        tableName: "tbl_stock_in_items",
        description: "Sent sales cost report via email.",
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
          title="Sales Cost"
          subtitle="View stock purchase costs from stock-in items."
          action={
            <ExportDropdownMenu
              onExportPdf={handlePrintSalesCostTable}
              onExportExcel={handleExportSalesCostExcel}
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
              <Text style={styles.summaryLabel}>Stock In {periodLabel}</Text>
              <Text style={styles.summaryValue}>{summary.totalStockIn.toLocaleString("id-ID")}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Items Purchased {periodLabel}</Text>
              <Text style={styles.summaryValue}>{summary.totalQty.toLocaleString("id-ID")}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Sales Cost {periodLabel}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalCost)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg / Stock In</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.averagePerStockIn)}</Text>
            </View>
          </View>
        </View>

        <InventoryFilterSection
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search stock in code, product, batch, or supplier"
          onOpenFilter={() => {
            setDraftProductFilter(productFilter);
            setDraftSupplierFilter(supplierFilter);
            setDraftDateStartFilter(dateStartFilter);
            setDraftDateEndFilter(dateEndFilter);
            setDraftMinQtyFilter(minQtyFilter);
            setDraftMaxQtyFilter(maxQtyFilter);
            setDraftMinTotalCostFilter(minTotalCostFilter);
            setDraftMaxTotalCostFilter(maxTotalCostFilter);
            setFilterOpen(true);
          }}
          activeFilters={activeFilters}
          onClearAllFilters={() => {
            setProductFilter("ALL");
            setSupplierFilter("ALL");
            applyPeriodFilter("TODAY");
            setMinQtyFilter("");
            setMaxQtyFilter("");
            setMinTotalCostFilter("");
            setMaxTotalCostFilter("");
          }}
        />

        <InventoryDataTable
          columns={tableColumns}
          rows={filteredRows}
          rowKey={(row) => row.id_stock_in_item}
          emptyText="No sales cost data found."
        />
      </ScrollView>

      <FilterSheetModal
        title="Filter Sales Cost"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            showResult("error", "Validation", "End date must be the same as or after Start date.");
            return;
          }
          setProductFilter(draftProductFilter);
          setSupplierFilter(draftSupplierFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setPeriodFilter("CUSTOM");
          setMinQtyFilter(draftMinQtyFilter);
          setMaxQtyFilter(draftMaxQtyFilter);
          setMinTotalCostFilter(draftMinTotalCostFilter);
          setMaxTotalCostFilter(draftMaxTotalCostFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftProductFilter("ALL");
          setProductFilter("ALL");
          setDraftSupplierFilter("ALL");
          setSupplierFilter("ALL");
          setDraftDateStartFilter("");
          setDraftDateEndFilter("");
          applyPeriodFilter("TODAY");
          setDraftMinQtyFilter("");
          setMinQtyFilter("");
          setDraftMaxQtyFilter("");
          setMaxQtyFilter("");
          setDraftMinTotalCostFilter("");
          setMinTotalCostFilter("");
          setDraftMaxTotalCostFilter("");
          setMaxTotalCostFilter("");
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
          label="Supplier"
          value={draftSupplierFilter}
          options={supplierOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftSupplierFilter}
        />
        <Text style={styles.filterLabel}>Stock In Date Range</Text>
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
        <Text style={styles.filterLabel}>Total Cost Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinTotalCostFilter} onChangeText={(value) => setDraftMinTotalCostFilter(value.replace(/[^0-9]/g, ""))} placeholder="Min total" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxTotalCostFilter} onChangeText={(value) => setDraftMaxTotalCostFilter(value.replace(/[^0-9]/g, ""))} placeholder="Max total" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
      </FilterSheetModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle="Sales Cost"
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
