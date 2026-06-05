import * as Print from "expo-print";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import DatePickerField from "../../../components/inventory/DatePickerField";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildBatchDetailReportPrintHtml,
  buildBatchTableReportPrintHtml,
} from "../../../components/reports/batches/BatchReportPrintTemplate";
import { API_BASE_URL } from "../../../utils/api";
import { logClientActivity } from "../../../utils/activityLog";
import { getAuthSession, normalizeRole } from "../../../utils/authSession";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";

type BatchRow = {
  id_product_batch: string;
  batch_code: string;
  expired_date: string;
  stock_in_time: string;
  product_name: string;
  supplier_name: string | null;
  qty_in: number;
  current_qty?: number | null;
  purchase_price?: number | null;
};

const printReportHtml = async (html: string) => {
  await logClientActivity({
    activityType: "PRINT_REPORT",
    tableName: "tbl_product_batches",
    description: "Printed product batch report.",
  });
  if (Platform.OS !== "web") {
    await Print.printAsync({ html });
    return;
  }

  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=1024,height=720");
  if (!printWindow) {
    throw new Error("Please allow pop-ups to print this report.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
};

const getBatchStockStatus = (qty: number) => {
  if (qty <= 0) return "out" as const;
  if (qty <= 5) return "low" as const;
  return "safe" as const;
};

export default function BatchesScreen() {
  const [roleName, setRoleName] = useState("CASHIER");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchRow | null>(null);
  const [openActionBatchId, setOpenActionBatchId] = useState<string | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"table" | "detail">("table");

  const [SupplierFilter, setSupplierFilter] = useState("ALL");
  const [draftSupplierFilter, setDraftSupplierFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [draftProductFilter, setDraftProductFilter] = useState("ALL");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [maxQtyFilter, setMaxQtyFilter] = useState("");
  const [draftMinQtyFilter, setDraftMinQtyFilter] = useState("");
  const [draftMaxQtyFilter, setDraftMaxQtyFilter] = useState("");
  const [dateInStart, setDateInStart] = useState("");
  const [dateInEnd, setDateInEnd] = useState("");
  const [draftDateInStart, setDraftDateInStart] = useState("");
  const [draftDateInEnd, setDraftDateInEnd] = useState("");
  const [expStart, setExpStart] = useState("");
  const [expEnd, setExpEnd] = useState("");
  const [draftExpStart, setDraftExpStart] = useState("");
  const [draftExpEnd, setDraftExpEnd] = useState("");
  const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));

  useEffect(() => {
    getAuthSession()
      .then((session) => setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER"))
      .catch(() => setRoleName("CASHIER"));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/batches`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setRows(safeRows);
      })
      .catch(() => setRows([]));
  }, []);

  const SupplierOptions = useMemo(
    () =>
      [
        "ALL",
        ...Array.from(
          new Set((Array.isArray(rows) ? rows : []).map((item) => item.supplier_name || "-"))
        ).sort(),
      ],
    [rows]
  );

  const DraftProductOptions = useMemo(() => {
    const source =
      draftSupplierFilter === "ALL"
        ? rows
        : rows.filter((item) => (item.supplier_name || "-") === draftSupplierFilter);
    return ["ALL", ...Array.from(new Set(source.map((item) => item.product_name || "-"))).sort()];
  }, [rows, draftSupplierFilter]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minQty = Number(minQtyFilter || "0");
    const maxQty = Number(maxQtyFilter || "0");
    const inStartDate = dateInStart ? new Date(`${dateInStart}T00:00:00`) : null;
    const inEndDate = dateInEnd ? new Date(`${dateInEnd}T23:59:59`) : null;
    const expStartDate = expStart ? new Date(`${expStart}T00:00:00`) : null;
    const expEndDate = expEnd ? new Date(`${expEnd}T23:59:59`) : null;
    return rows.filter((item) => {
      const stockInDate = item.stock_in_time ? new Date(item.stock_in_time) : null;
      const expiredDate = item.expired_date ? new Date(item.expired_date) : null;
      const matchSearch =
        !query ||
        `${item.batch_code} ${item.product_name} ${item.supplier_name || "-"}`
          .toLowerCase()
          .includes(query);
      const matchSupplier =
        SupplierFilter === "ALL"
          ? true
          : (item.supplier_name || "-") === SupplierFilter;
      const matchProduct = productFilter === "ALL" ? true : (item.product_name || "-") === productFilter;       
      const minQtyMatch = minQtyFilter.trim() ? item.qty_in >= minQty : true;
      const maxQtyMatch = maxQtyFilter.trim() ? item.qty_in <= maxQty : true;
      const dateInStartMatch = inStartDate && stockInDate ? stockInDate >= inStartDate : true;
      const dateInEndMatch = inEndDate && stockInDate ? stockInDate <= inEndDate : true;
      const expStartMatch = expStartDate && expiredDate ? expiredDate >= expStartDate : true;
      const expEndMatch = expEndDate && expiredDate ? expiredDate <= expEndDate : true;

      return (
        matchSearch &&
        matchSupplier &&
        matchProduct &&
        minQtyMatch &&
        maxQtyMatch &&
        dateInStartMatch &&
        dateInEndMatch &&
        expStartMatch &&
        expEndMatch
      );
    });
  }, [rows, search, SupplierFilter, productFilter, minQtyFilter, maxQtyFilter, dateInStart, dateInEnd, expStart, expEnd]);

  const sortedBatches = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const left = a.stock_in_time ? new Date(a.stock_in_time).getTime() : 0;
        const right = b.stock_in_time ? new Date(b.stock_in_time).getTime() : 0;
        return right - left;
      }),
    [filtered]
  );

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (SupplierFilter !== "ALL") items.push({ key: "supplier", label: "Supplier", value: SupplierFilter, onClear: () => setSupplierFilter("ALL") });
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (minQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minQtyFilter, onClear: () => setMinQtyFilter("") });
    if (maxQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxQtyFilter, onClear: () => setMaxQtyFilter("") });
    if (dateInStart) items.push({ key: "dateInStart", label: "Date In Start", value: dateInStart, onClear: () => setDateInStart("") });
    if (dateInEnd) items.push({ key: "dateInEnd", label: "Date In End", value: dateInEnd, onClear: () => setDateInEnd("") });
    if (expStart) items.push({ key: "expStart", label: "Exp Start", value: expStart, onClear: () => setExpStart("") });
    if (expEnd) items.push({ key: "expEnd", label: "Exp End", value: expEnd, onClear: () => setExpEnd("") });   
    return items;
  }, [SupplierFilter, productFilter, minQtyFilter, maxQtyFilter, dateInStart, dateInEnd, expStart, expEnd]);    

  const buildCurrentBatchReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (SupplierFilter !== "ALL") items.push({ label: "Supplier Filter", value: SupplierFilter });
    if (productFilter !== "ALL") items.push({ label: "Product Filter", value: productFilter });
    if (minQtyFilter.trim()) items.push({ label: "Min Qty", value: minQtyFilter });
    if (maxQtyFilter.trim()) items.push({ label: "Max Qty", value: maxQtyFilter });
    if (dateInStart) items.push({ label: "Date In Start", value: dateInStart });
    if (dateInEnd) items.push({ label: "Date In End", value: dateInEnd });
    if (expStart) items.push({ label: "Exp Start", value: expStart });
    if (expEnd) items.push({ label: "Exp End", value: expEnd });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string) => {
    try {
      const isTable = emailTarget === "table";
      const generatedAt = new Date();
      const printHtml = isTable
        ? buildBatchTableReportPrintHtml({
            rows: Array.isArray(sortedBatches) ? sortedBatches : [],
            generatedAt,
            generatedBy: roleName,
            meta: buildCurrentBatchReportMeta(),
          })
        : selectedBatch
          ? buildBatchDetailReportPrintHtml({
              batch: selectedBatch,
              generatedAt,
              generatedBy: roleName,
            })
          : "";
      const payload = {
        recipient_email: recipientEmail,
        subject: isTable ? "Product Batch List Report" : `Batch Detail - ${selectedBatch?.batch_code}`,
        message,
        format: "PDF",
        title: isTable ? "Product Batch List" : "Batch Detail",
        generated_by: roleName,
        print_html: printHtml,
        meta: isTable ? buildCurrentBatchReportMeta() : [
          { label: "Batch Code", value: selectedBatch?.batch_code },
          { label: "Product", value: selectedBatch?.product_name },
          { label: "Supplier", value: selectedBatch?.supplier_name },
        ],
        columns: isTable ? [
          { key: "batch_code", title: "Batch" },
          { key: "product_name", title: "Product" },
          { key: "qty_in", title: "Qty In" },
          { key: "current_qty", title: "Current Qty" },
          { key: "stock_in_time", title: "Date In" },
          { key: "expired_date", title: "Expired" },
        ] : [
          { key: "batch_code", title: "Batch" },
          { key: "product_name", title: "Product" },
          { key: "qty_in", title: "Qty In" },
          { key: "current_qty", title: "Current Qty" },
          { key: "purchase_price", title: "Buy Price" },
        ],
        rows: isTable ? sortedBatches : [selectedBatch],
      };

      const response = await fetch(`${API_BASE_URL}/api/reports/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_product_batches",
        description: "Sent product batch report via email.",
      });

      Alert.alert("Success", "Email has been sent successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "An error occurred.");
    }
  };

  const handlePrintBatchTable = async () => {
    try {
      const html = buildBatchTableReportPrintHtml({
        rows: Array.isArray(sortedBatches) ? sortedBatches : [],
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentBatchReportMeta(),
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : "Failed to print batch report.");    
    }
  };

  const handlePrintBatchDetail = async () => {
    if (!selectedBatch) return;

    try {
      const html = buildBatchDetailReportPrintHtml({
        batch: selectedBatch,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : "Failed to print batch detail.");    
    }
  };

  const formatDateOnly = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  };
  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const batchColumns = useMemo<InventoryDataTableColumn<BatchRow>[]>(() => [
    {
      key: "batch_code",
      title: "Batch",
      weight: 20,
      sortable: true,
      sortValue: (row) => row.batch_code || "",
      render: (item) => <Text style={styles.rowCell}>{item.batch_code}</Text>,
    },
    {
      key: "product_name",
      title: "Product",
      weight: 28,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.product_name || "-"}</Text>,       
    },
    {
      key: "qty_in",
      title: "Qty In",
      weight: 8,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.qty_in || 0),
      render: (item) => {
        const statusTone = getBatchStockStatus(Number(item.current_qty ?? item.qty_in ?? 0));
        return (
          <View style={styles.stockCellWrap}>
            <View
              style={[
                styles.stockBadge,
                statusTone === "out" ? styles.stockBadgeOut : statusTone === "low" ? styles.stockBadgeLow : styles.stockBadgeSafe,
              ]}
            >
              <Text
                style={[
                  styles.stockBadgeText,
                  statusTone === "out" ? styles.stockTextOut : statusTone === "low" ? styles.stockTextLow : styles.stockTextSafe,
                ]}
              >
                {item.qty_in}
              </Text>
            </View>
          </View>
        );
      },
    },
    {
      key: "stock_in_time",
      title: "Date In",
      weight: 18,
      sortable: true,
      sortValue: (row) => new Date(row.stock_in_time).getTime(),
      render: (item) => <Text style={styles.rowCell}>{formatDateTime(item.stock_in_time)}</Text>,
    },
    {
      key: "expired_date",
      title: "Expired Date",
      weight: 12,
      sortable: true,
      sortValue: (row) => new Date(row.expired_date).getTime(),
      render: (item) => <Text style={styles.rowCell}>{formatDateOnly(item.expired_date)}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 12,
      align: "center",
      render: (item, meta) => (
        <View style={styles.actionCellWrap}>
          <InventoryRowActionsMenu
            open={openActionBatchId === item.id_product_batch}
            onToggle={() => setOpenActionBatchId((prev) => (prev === item.id_product_batch ? null : item.id_product_batch))}
            direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
          >
            <Pressable
              style={[styles.actionOutlineBtn, styles.actionOutlineInfo]}
              onPress={() => {
                setOpenActionBatchId(null);
                setSelectedBatch(item);
              }}
            >
              <Text
                style={[
                  styles.actionOutlineBtnText,
                  styles.actionOutlineInfoText,
                ]}
              >
                See Details
              </Text>
            </Pressable>
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [openActionBatchId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Batches</Text>
          <Text style={styles.pageSubtitle}>Read-only batch ledger generated automatically from stock in.</Text>
        </View>
        <ExportDropdownMenu
          onExportPdf={handlePrintBatchTable}
          onExportExcel={() => Alert.alert("Export Excel", "This feature will be implemented soon.")}
          onSendEmail={() => {
            setEmailTarget("table");
            setEmailModalOpen(true);
          }}
        />
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search batch code, product, or supplier" placeholderTextColor="#94a3b8" style={styles.searchInput} />
          <IconFilterButton onPress={() => {
            setDraftSupplierFilter(SupplierFilter);
            setDraftProductFilter(productFilter);
            setDraftMinQtyFilter(minQtyFilter);
            setDraftMaxQtyFilter(maxQtyFilter);
            setDraftDateInStart(dateInStart);
            setDraftDateInEnd(dateInEnd);
            setDraftExpStart(expStart);
            setDraftExpEnd(expEnd);
            setFilterOpen(true);
          }} />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setSupplierFilter("ALL");
            setProductFilter("ALL");
            setMinQtyFilter("");
            setMaxQtyFilter("");
            setDateInStart("");
            setDateInEnd("");
            setExpStart("");
            setExpEnd("");
            setDraftSupplierFilter("ALL");
            setDraftProductFilter("ALL");
            setDraftMinQtyFilter("");
            setDraftMaxQtyFilter("");
            setDraftDateInStart("");
            setDraftDateInEnd("");
            setDraftExpStart("");
            setDraftExpEnd("");
          }}
        />
      </View>

      <InventoryDataTable
        columns={batchColumns}
        rows={Array.isArray(sortedBatches) ? sortedBatches : []}
        rowKey={(item) => item.id_product_batch}
        isRowActive={(item) => openActionBatchId === item.id_product_batch}
        emptyText="No batches found."
      />

      <FilterSheetModal
        title="Filter Batches"
        visible={filterOpen}
        onApply={() => {
          if (draftDateInStart && draftDateInEnd && toDayNumber(draftDateInEnd) < toDayNumber(draftDateInStart)) {
            Alert.alert("Validation", "End Date In harus sama atau setelah Start Date In.");
            return;
          }
          if (draftExpStart && draftExpEnd && toDayNumber(draftExpEnd) < toDayNumber(draftExpStart)) {
            Alert.alert("Validation", "End Exp Date harus sama atau setelah Start Exp Date.");
            return;
          }
          setSupplierFilter(draftSupplierFilter);
          setProductFilter(draftProductFilter);
          setMinQtyFilter(draftMinQtyFilter);
          setMaxQtyFilter(draftMaxQtyFilter);
          setDateInStart(draftDateInStart);
          setDateInEnd(draftDateInEnd);
          setExpStart(draftExpStart);
          setExpEnd(draftExpEnd);
          setFilterOpen(false);
        }}
        onReset={() => {
          setSupplierFilter("ALL");
          setProductFilter("ALL");
          setMinQtyFilter("");
          setMaxQtyFilter("");
          setDateInStart("");
          setDateInEnd("");
          setExpStart("");
          setExpEnd("");
          setDraftSupplierFilter("ALL");
          setDraftProductFilter("ALL");
          setDraftMinQtyFilter("");
          setDraftMaxQtyFilter("");
          setDraftDateInStart("");
          setDraftDateInEnd("");
          setDraftExpStart("");
          setDraftExpEnd("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Supplier"
          value={draftSupplierFilter}
          options={SupplierOptions.map((item) => ({ label: item, value: item }))}
          onChange={(value) => {
            setDraftSupplierFilter(value);
            setDraftProductFilter("ALL");
          }}
        />
        <FilterSelectField
          label="Product"
          value={draftProductFilter}
          options={DraftProductOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftProductFilter}
        />
        <Text style={styles.filterLabel}>Qty Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinQtyFilter} onChangeText={setDraftMinQtyFilter} placeholder="Min Qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxQtyFilter} onChangeText={setDraftMaxQtyFilter} placeholder="Max Qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
        <Text style={styles.filterLabel}>Date In Range</Text>
        <View style={styles.rangeRow}>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="Start Date In"
              value={draftDateInStart}
              placeholder="Select start date"
              onChange={setDraftDateInStart}
              maximumDate={draftDateInEnd ? new Date(`${draftDateInEnd}T00:00:00`) : undefined}
            />
          </View>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="End Date In"
              value={draftDateInEnd}
              placeholder="Select end date"
              onChange={setDraftDateInEnd}
              minimumDate={draftDateInStart ? new Date(`${draftDateInStart}T00:00:00`) : undefined}
            />
          </View>
        </View>
        <Text style={styles.filterLabel}>Expired Date Range</Text>
        <View style={styles.rangeRow}>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="Start Exp Date"
              value={draftExpStart}
              placeholder="Select start exp date"
              onChange={setDraftExpStart}
              maximumDate={draftExpEnd ? new Date(`${draftExpEnd}T00:00:00`) : undefined}
            />
          </View>
          <View style={styles.dateFieldWrap}>
            <DatePickerField
              label="End Exp Date"
              value={draftExpEnd}
              placeholder="Select end exp date"
              onChange={setDraftExpEnd}
              minimumDate={draftExpStart ? new Date(`${draftExpStart}T00:00:00`) : undefined}
            />
          </View>
        </View>
      </FilterSheetModal>

      <ResponsiveModal
        visible={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
            <View style={styles.detailModalHeader}>
              <Text style={styles.modalTitle}>Batch Detail</Text>
              <ExportDropdownMenu
                variant="detail"
                onExportPdf={handlePrintBatchDetail}
                onSendEmail={() => {
                  setEmailTarget("detail");
                  setEmailModalOpen(true);
                }}     
              />
            </View>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Batch Code</Text><Text style={styles.metaValue}>{selectedBatch?.batch_code || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Product Name</Text><Text style={styles.metaValue}>{selectedBatch?.product_name || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Date In</Text><Text style={styles.metaValue}>{formatDateTime(selectedBatch?.stock_in_time)}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Expired Date</Text><Text style={styles.metaValue}>{formatDateOnly(selectedBatch?.expired_date)}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Qty In</Text><Text style={styles.metaValue}>{selectedBatch?.qty_in || 0}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Current Qty</Text><Text style={styles.metaValue}>{Number(selectedBatch?.current_qty ?? selectedBatch?.qty_in ?? 0)}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Buy / Pcs</Text><Text style={styles.metaValue}>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(selectedBatch?.purchase_price || 0)).replace(/\s/g, " ")}</Text></View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total Buy</Text>
                <Text style={styles.metaValue}>
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
                    .format(Number(selectedBatch?.purchase_price || 0) * Number(selectedBatch?.qty_in || 0))    
                    .replace(/\s/g, " ")}
                </Text>
              </View>
            </View>
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedBatch(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
      </ResponsiveModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "Product Batch List" : "Batch Detail"}
        onSend={handleSendEmailReport}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pageTitle: { fontSize: 30, color: "#0f2852", fontWeight: "800" },
  pageSubtitle: { marginTop: 4, color: "#64748b", fontSize: 13 },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  filterCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", paddingHorizontal: 12, color: "#0f172a" },
  tableCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "visible" },
  tableInner: { width: "100%" },
  tableHeader: { minHeight: 42, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7", position: "relative", zIndex: 1 },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },    
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  stockCellWrap: { justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  stockBadge: {
    minWidth: 44,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stockBadgeText: { fontWeight: "700", fontSize: 12 },
  stockBadgeOut: { borderColor: "#ef4444" },
  stockTextOut: { color: "#b91c1c" },
  stockBadgeLow: { borderColor: "#f59e0b" },
  stockTextLow: { color: "#92400e" },
  stockBadgeSafe: { borderColor: "#22c55e" },
  stockTextSafe: { color: "#166534" },
  colBatch: { width: "20%" }, colProduct: { width: "28%" }, colQty: { width: "10%" }, colDateIn: { width: "18%" }, colExp: { width: "12%" }, colAction: { width: "12%", textAlign: "center" },
  actionCellWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 10, color: "#0f172a" },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  detailPrintButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrintButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  metaItem: { width: "49%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closeBtn: { marginTop: 6, minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
