import * as Print from "expo-print";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { InventoryConfirmModal, InventoryResultModal } from "../../../components/inventory/ActionModals";       
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildStockOutDetailReportPrintHtml,
  buildStockOutTableReportPrintHtml,
} from "../../../components/reports/stock-out/StockOutReportPrintTemplate";
import { API_BASE_URL } from "../../../utils/api";
import { logClientActivity } from "../../../utils/activityLog";
import { canInsertStockMovement, getAuthSession, normalizeRole } from "../../../utils/authSession";

type StockOutDocument = {
  id_stock_out: string;
  stock_out_code: string;
  stock_out_type?: string;
  cashier_name?: string;
  operator_name?: string;
  product_names?: string[];
  reason?: string | null;
  stock_out_date: string;
  notes: string | null;
  item_count: number;
  total_qty: number;
  total_buy?: number;
  total_sell?: number;
  total_profit?: number;
};

type StockOutItem = {
  id_stock_movement: string;
  product_code: string;
  product_name: string;
  batch_code: string | null;
  quantity: number;
  reason?: string | null;
  buy_per_pcs?: number | null;
  sell_per_pcs?: number | null;
  total_buy?: number;
  total_sell?: number;
  profit?: number;
};

type StockOutDetail = {
  id_stock_out: string;
  stock_out_code: string;
  stock_out_type?: string;
  cashier_name?: string;
  operator_name?: string;
  stock_out_date: string;
  notes: string | null;
  total_qty: number;
  total_buy?: number;
  total_sell?: number;
  total_profit?: number;
  items: StockOutItem[];
};

type Product = {
  id_product: string;
  product_code: string;
  product_name: string;
  available_stock: number;
  is_active?: string;
};

type ProductBatch = {
  id_product_batch: string;
  batch_code: string;
  expired_date?: string | null;
  batch_qty: number;
};

type DraftItem = { id_product: string; id_product_batch?: string; quantity: string };

const MANUAL_REASONS = ["DAMAGED", "EXPIRED", "RETURN_TO_SUPPLIER", "LOST", "DONATION", "OTHER"];
const formatCurrency = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");
const isRefundStockOutType = (value?: string | null) => String(value || "").toUpperCase() === "RETURN_TO_SUPPLIER_REFUND";

const printReportHtml = async (html: string) => {
  await logClientActivity({
    activityType: "PRINT_REPORT",
    tableName: "tbl_stock_movements",
    description: "Printed stock out report.",
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

export default function StockOutScreen() {
  const [rows, setRows] = useState<StockOutDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<StockOutDetail | null>(null);
  const [openActionStockOutId, setOpenActionStockOutId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"table" | "detail">("table");

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [draftTypeFilter, setDraftTypeFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [draftProductFilter, setDraftProductFilter] = useState("ALL");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [draftDateStartFilter, setDraftDateStartFilter] = useState("");
  const [draftDateEndFilter, setDraftDateEndFilter] = useState("");
  const [minItemCountFilter, setMinItemCountFilter] = useState("");
  const [maxItemCountFilter, setMaxItemCountFilter] = useState("");
  const [draftMinItemCountFilter, setDraftMinItemCountFilter] = useState("");
  const [draftMaxItemCountFilter, setDraftMaxItemCountFilter] = useState("");
  const [minTotalQtyFilter, setMinTotalQtyFilter] = useState("");
  const [maxTotalQtyFilter, setMaxTotalQtyFilter] = useState("");
  const [draftMinTotalQtyFilter, setDraftMinTotalQtyFilter] = useState("");
  const [draftMaxTotalQtyFilter, setDraftMaxTotalQtyFilter] = useState("");
  const [minProfitFilter, setMinProfitFilter] = useState("");
  const [maxProfitFilter, setMaxProfitFilter] = useState("");
  const [draftMinProfitFilter, setDraftMinProfitFilter] = useState("");
  const [draftMaxProfitFilter, setDraftMaxProfitFilter] = useState("");

  const [manualReason, setManualReason] = useState("DAMAGED");
  const [manualReturnRefund, setManualReturnRefund] = useState<"" | "YES" | "NO">("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualItems, setManualItems] = useState<DraftItem[]>([{ id_product: "", quantity: "" }]);
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [batchesByProduct, setBatchesByProduct] = useState<Record<string, ProductBatch[]>>({});

  const canInsert = canInsertStockMovement(roleName);

  const getProductAvailableQty = (idProduct: string) => {
    const batches = batchesByProduct[idProduct] || [];
    const batchTotal = batches.length > 0
      ? batches.reduce((sum, batch) => sum + Number(batch.batch_qty || 0), 0)
      : 0;
    return batchTotal > 0 ? batchTotal : Number(stockByProductId[idProduct] || 0);
  };

  const getSelectedBatchAvailableQty = (idProduct: string, idProductBatch?: string) => {
    if (!idProductBatch) {
      return getProductAvailableQty(idProduct);
    }

    const batches = batchesByProduct[idProduct] || [];
    const selectedBatch = batches.find((batch) => batch.id_product_batch === idProductBatch);
    if (!selectedBatch) {
      return getProductAvailableQty(idProduct);
    }

    return Number(selectedBatch.batch_qty || 0);
  };

  const clampManualItemQuantity = (idProduct: string, idProductBatch: string | undefined, rawValue: string) => {
    const digits = rawValue.replace(/[^0-9]/g, "");
    if (!idProduct) {
      return digits;
    }

    const maxQty = Math.max(0, getSelectedBatchAvailableQty(idProduct, idProductBatch));
    if (!digits) {
      return "";
    }

    return String(Math.min(Number(digits), maxQty));
  };

  const loadRows = () => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/stock-out-documents`).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/stock-out-manual-documents`).then((r) => r.json()),
    ])
      .then(([salePayload, manualPayload]) => {
        const saleRows = Array.isArray(salePayload?.data) ? salePayload.data : [];
        const manualRowsRaw = Array.isArray(manualPayload?.data) ? manualPayload.data : [];
        const manualRows = manualRowsRaw.map((row: any) => ({
          ...row,
          id_stock_out: row.id_stock_out_manual,
        }));
        const mergedRows = [...saleRows, ...manualRows].sort(
          (a: any, b: any) =>
            new Date(String(b?.stock_out_date || 0)).getTime() -
            new Date(String(a?.stock_out_date || 0)).getTime()
        );
        setRows(mergedRows as StockOutDocument[]);
      })
      .catch(() => setRows([]));
  };

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
        setUserId(session?.user?.id_user || "");
      })
      .catch(() => setRoleName("CASHIER"));
    loadRows();
    fetch(`${API_BASE_URL}/api/products`)
      .then((r) => r.json())
      .then((p) => {
        const data = Array.isArray(p?.data) ? p.data : [];
        setProducts(data.filter((x: any) => x.is_active !== "N"));
        const map: any = {};
        data.forEach((x: any) => (map[x.id_product] = Number(x.available_stock || 0)));
        setStockByProductId(map);
      });
  }, []);

  const loadBatchesByProduct = (idProduct: string) => {
    if (batchesByProduct[idProduct]) return;
    fetch(`${API_BASE_URL}/api/products/${idProduct}/batches`)
      .then((r) => r.json())
      .then((p) => {
        setBatchesByProduct((prev) => ({ ...prev, [idProduct]: Array.isArray(p?.data) ? p.data : [] }));
      });
  };

  const typeOptions = ["ALL", "SALE", ...MANUAL_REASONS];
  const productFilterOptions = useMemo(() => ["ALL", ...Array.from(new Set(products.map((x) => x.product_name))).sort()], [products]);
  const formProductOptions = useMemo(() => products.map((x) => ({ label: `${x.product_name} (${x.product_code})`, value: x.id_product })), [products]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minItemCount = Number(minItemCountFilter || "0");
    const maxItemCount = Number(maxItemCountFilter || "0");
    const minTotalQty = Number(minTotalQtyFilter || "0");
    const maxTotalQty = Number(maxTotalQtyFilter || "0");
    const minProfit = Number(minProfitFilter || "-999999999");
    const maxProfit = Number(maxProfitFilter || "999999999");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;

    return rows.filter((item) => {
      const itemDate = item.stock_out_date ? new Date(item.stock_out_date) : null;
      const itemProducts = Array.isArray(item.product_names) ? item.product_names : [];
      const matchSearch = !query || `${item.stock_out_code} ${item.notes || ""} ${itemProducts.join(" ")}`.toLowerCase().includes(query);
      const itemType = String(item.stock_out_type || "SALE").toUpperCase();
      const matchType = typeFilter === "ALL" ? true : itemType === typeFilter;
      const matchProduct = productFilter === "ALL" ? true : itemProducts.includes(productFilter);
      const matchItemCountMin = minItemCountFilter.trim() ? item.item_count >= minItemCount : true;
      const matchItemCountMax = maxItemCountFilter.trim() ? item.item_count <= maxItemCount : true;
      const matchTotalQtyMin = minTotalQtyFilter.trim() ? item.total_qty >= minTotalQty : true;
      const matchTotalQtyMax = maxTotalQtyFilter.trim() ? item.total_qty <= maxTotalQty : true;
      const matchProfitMin = (typeFilter === "SALE" && minProfitFilter.trim()) ? (item.total_profit || 0) >= minProfit : true;
      const matchProfitMax = (typeFilter === "SALE" && maxProfitFilter.trim()) ? (item.total_profit || 0) <= maxProfit : true;
      const matchStartDate = startDate && itemDate ? itemDate >= startDate : true;
      const matchEndDate = endDate && itemDate ? itemDate <= endDate : true;

      return (
        matchSearch && matchType && matchProduct && matchItemCountMin && matchItemCountMax &&
        matchTotalQtyMin && matchTotalQtyMax && matchProfitMin && matchProfitMax &&
        matchStartDate && matchEndDate
      );
    });
  }, [rows, search, typeFilter, productFilter, minItemCountFilter, maxItemCountFilter, minTotalQtyFilter, maxTotalQtyFilter, minProfitFilter, maxProfitFilter, dateStartFilter, dateEndFilter]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (typeFilter !== "ALL") items.push({ key: "type", label: "Type", value: typeFilter, onClear: () => setTypeFilter("ALL") });
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (dateStartFilter) items.push({ key: "dateStart", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (dateEndFilter) items.push({ key: "dateEnd", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minItemCountFilter) items.push({ key: "minItem", label: "Min Items", value: minItemCountFilter, onClear: () => setMinItemCountFilter("") });
    if (maxItemCountFilter) items.push({ key: "maxItem", label: "Max Items", value: maxItemCountFilter, onClear: () => setMaxItemCountFilter("") });
    if (minTotalQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minTotalQtyFilter, onClear: () => setMinTotalQtyFilter("") });
    if (maxTotalQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxTotalQtyFilter, onClear: () => setMaxTotalQtyFilter("") });
    if (typeFilter === "SALE" && minProfitFilter) items.push({ key: "minProfit", label: "Min Profit", value: formatCurrency(Number(minProfitFilter)), onClear: () => setMinProfitFilter("") });
    if (typeFilter === "SALE" && maxProfitFilter) items.push({ key: "maxProfit", label: "Max Profit", value: formatCurrency(Number(maxProfitFilter)), onClear: () => setMaxProfitFilter("") });
    return items;
  }, [typeFilter, productFilter, dateStartFilter, dateEndFilter, minItemCountFilter, maxItemCountFilter, minTotalQtyFilter, maxTotalQtyFilter, minProfitFilter, maxProfitFilter]);

  const buildCurrentStockOutReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (typeFilter !== "ALL") items.push({ label: "Type Filter", value: typeFilter });
    if (productFilter !== "ALL") items.push({ label: "Product Filter", value: productFilter });
    if (dateStartFilter) items.push({ label: "Start Date", value: dateStartFilter });
    if (dateEndFilter) items.push({ label: "End Date", value: dateEndFilter });
    if (minItemCountFilter.trim()) items.push({ label: "Min Items", value: minItemCountFilter });
    if (maxItemCountFilter.trim()) items.push({ label: "Max Items", value: maxItemCountFilter });
    if (minTotalQtyFilter.trim()) items.push({ label: "Min Qty", value: minTotalQtyFilter });
    if (maxTotalQtyFilter.trim()) items.push({ label: "Max Qty", value: maxTotalQtyFilter });
    if (typeFilter === "SALE" && minProfitFilter.trim()) items.push({ label: "Min Profit", value: formatCurrency(Number(minProfitFilter)) });
    if (typeFilter === "SALE" && maxProfitFilter.trim()) items.push({ label: "Max Profit", value: formatCurrency(Number(maxProfitFilter)) });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string) => {
    try {
      const isTable = emailTarget === "table";
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: isTable ? "Stock Out List Report" : `Stock Out Detail - ${selectedDoc?.stock_out_code}`,       
        message,
        format: "PDF",
        title: isTable ? "Stock Out List" : "Stock Out Detail",
        generated_by: roleName,
        meta: isTable ? buildCurrentStockOutReportMeta() : [
          { label: "Code", value: selectedDoc?.stock_out_code },
          { label: "Type", value: displayText(selectedDoc?.stock_out_type) },
          { label: "Date", value: new Date(selectedDoc?.stock_out_date || "").toLocaleString("id-ID") },        
        ],
        columns: isTable ? [
          { key: "stock_out_code", title: "Code" },
          { key: "stock_out_type", title: "Type" },
          { key: "item_count", title: "Items" },
          { key: "total_qty", title: "Qty" },
          { key: "stock_out_date", title: "Date" },
        ] : [
          { key: "product_name", title: "Product" },
          { key: "batch_code", title: "Batch" },
          { key: "quantity", title: "Qty" },
        ],
        rows: isTable ? filteredRows : selectedDoc?.items || [],
      };

      const response = await fetch(`${API_BASE_URL}/api/reports/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to send email.");

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

  const handlePrintStockOutTable = async () => {
    try {
      const html = buildStockOutTableReportPrintHtml({
        rows: Array.isArray(filteredRows) ? filteredRows : [],
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentStockOutReportMeta(),
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : "Failed to print stock out report.");
    }
  };

  const handlePrintStockOutDetail = async () => {
    if (!selectedDoc) return;
    try {
      const html = buildStockOutDetailReportPrintHtml({
        document: selectedDoc,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : "Failed to print stock out detail.");
    }
  };

  const tableColumns = useMemo<InventoryDataTableColumn<StockOutDocument>[]>(() => [
    { key: "stock_out_code", title: "Code", weight: 30, sortable: true, sortValue: (row) => row.stock_out_code || "", render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.stock_out_code}</Text> },
    { key: "stock_out_type", title: "Type", weight: 16, sortable: true, sortValue: (row) => row.stock_out_type || "SALE", render: (row) => <Text style={styles.rowCell}>{displayText(row.stock_out_type || "SALE")}</Text> },   
    { key: "item_count", title: "Items", weight: 10, align: "center", sortable: true, sortValue: (row) => Number(row.item_count || 0), render: (row) => <Text style={styles.rowCell}>{row.item_count}</Text> },
    { key: "total_qty", title: "Total Qty", weight: 12, align: "center", sortable: true, sortValue: (row) => Number(row.total_qty || 0), render: (row) => <Text style={styles.rowCell}>{row.total_qty}</Text> },
    { key: "stock_out_date", title: "Date", weight: 18, sortable: true, sortValue: (row) => new Date(row.stock_out_date).getTime(), render: (row) => <Text style={styles.rowCell}>{new Date(row.stock_out_date).toLocaleString("id-ID")}</Text> },
    { key: "action", title: "Action", weight: 14, align: "center", render: (row, meta) => (
      <View style={[styles.actionWrap, openActionStockOutId === row.id_stock_out ? styles.actionWrapOpen : null]}>
        <InventoryRowActionsMenu open={openActionStockOutId === row.id_stock_out} onToggle={() => setOpenActionStockOutId((prev) => (prev === row.id_stock_out ? null : row.id_stock_out))} direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}>
          <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionStockOutId(null); openDetail(row); }}><Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text></Pressable>
        </InventoryRowActionsMenu>
      </View>
    ) },
  ], [openActionStockOutId]);

  const saleDetailColumns = useMemo<InventoryDataTableColumn<StockOutItem>[]>(() => [
    { key: "product_name", title: "Product", weight: 18, render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.product_name}</Text> },
    { key: "batch_code", title: "Batch", weight: 16, render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.batch_code || "-"}</Text> },
    { key: "quantity", title: "Qty", weight: 7, align: "center", render: (r) => <Text style={styles.detailRowCell}>{r.quantity}</Text> },
    { key: "buy_per_pcs", title: "Buy/Pcs", weight: 11.83, render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.buy_per_pcs || 0))}</Text> },
    { key: "sell_per_pcs", title: "Sell/Pcs", weight: 11.83, render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.sell_per_pcs || 0))}</Text> },
    { key: "total_buy", title: "Total Buy", weight: 11.83, render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.total_buy || 0))}</Text> },
    { key: "total_sell", title: "Total Sell", weight: 11.83, render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.total_sell || 0))}</Text> },
    { key: "profit", title: "Profit", weight: 11.83, render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.profit || 0))}</Text> },
  ], []);

  const nonSaleNoRefundDetailColumns = useMemo<InventoryDataTableColumn<StockOutItem>[]>(() => [
    { key: "product_name", title: "Product", weight: 32, sortable: true, sortValue: (r) => r.product_name || "", render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.product_name}</Text> },
    { key: "batch_code", title: "Batch", weight: 26, sortable: true, sortValue: (r) => r.batch_code || "", render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.batch_code || "-"}</Text> },
    { key: "quantity", title: "Qty", weight: 10, align: "center", sortable: true, sortValue: (r) => Number(r.quantity || 0), render: (r) => <Text style={styles.detailRowCell}>{r.quantity}</Text> },
    { key: "reason", title: "Reason", weight: 32, sortable: true, sortValue: (r) => r.reason || "", render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{displayText(r.reason)}</Text> },
  ], []);

  const nonSaleRefundDetailColumns = useMemo<InventoryDataTableColumn<StockOutItem>[]>(() => [
    { key: "product_name", title: "Product", weight: 18, sortable: true, sortValue: (r) => r.product_name || "", render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.product_name}</Text> },
    { key: "batch_code", title: "Batch", weight: 22, sortable: true, sortValue: (r) => r.batch_code || "", render: (r) => <Text style={styles.detailRowCell} numberOfLines={1}>{r.batch_code || "-"}</Text> },
    { key: "quantity", title: "Qty", weight: 8, align: "center", sortable: true, sortValue: (r) => Number(r.quantity || 0), render: (r) => <Text style={styles.detailRowCell}>{r.quantity}</Text> },
    { key: "buy_per_pcs", title: "Buy/Pcs", weight: 16, sortable: true, sortValue: (r) => Number(r.buy_per_pcs || 0), render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.buy_per_pcs || 0))}</Text> },  
    { key: "refund_per_pcs", title: "Refund/Pcs", weight: 17, sortable: true, sortValue: (r) => Number(r.buy_per_pcs || 0), render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.buy_per_pcs || 0))}</Text> },
    {
      key: "total_refund",
      title: "Total Refund",
      weight: 17,
      sortable: true,
      sortValue: (r) => Number(r.total_buy ?? (Number(r.buy_per_pcs || 0) * Number(r.quantity || 0))),
      render: (r) => <Text style={styles.detailRowCell}>{formatCurrency(Number(r.total_buy ?? (Number(r.buy_per_pcs || 0) * Number(r.quantity || 0))))}</Text>,
    },
  ], []);

  const openDetail = async (row: StockOutDocument) => {
    const type = String(row.stock_out_type || "SALE").toUpperCase();
    const endpoint = type === "SALE" ? `${API_BASE_URL}/api/stock-out-documents/${row.id_stock_out}` : `${API_BASE_URL}/api/stock-out-manual-documents/${row.id_stock_out}`;
    try {
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to fetch stock out detail.");
      setSelectedDoc(payload?.data || null);
    } catch (error) {
      setSelectedDoc(null);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to fetch stock out detail.");       
    }
  };

  const submitManualStockOut = async () => {
    if (!userId) {
      setResultStatus("error"); setResultTitle("Action Failed"); setResultMessage("User session was not found. Please sign in again.");
      setResultModalOpen(true); return;
    }
    if (manualReason === "RETURN_TO_SUPPLIER" && !manualReturnRefund) {
      setResultStatus("error"); setResultTitle("Validation Error"); setResultMessage("Please choose refund status for RETURN_TO_SUPPLIER.");
      setResultModalOpen(true); return;
    }
    if (!manualNotes.trim()) {
      setResultStatus("error"); setResultTitle("Validation Error"); setResultMessage("Notes are required.");    
      setResultModalOpen(true); return;
    }
    const invalid = manualItems.some((item) => !item.id_product || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0);
    if (invalid) {
      setResultStatus("error"); setResultTitle("Validation Error"); setResultMessage("Each row must have a selected product and qty > 0.");
      setResultModalOpen(true); return;
    }
    const exceedsStock = manualItems.find((item) => Number(item.quantity) > getSelectedBatchAvailableQty(item.id_product, item.id_product_batch));
    if (exceedsStock) {
      const maxStock = getSelectedBatchAvailableQty(exceedsStock.id_product, exceedsStock.id_product_batch);
      setResultStatus("error"); setResultTitle("Validation Error"); setResultMessage(`Qty cannot exceed current stock (${maxStock}).`);
      setResultModalOpen(true); return;
    }
    const exceedsSelectedBatch = manualItems.find((item) => {
      if (!item.id_product || !item.id_product_batch) return false;
      const batches = batchesByProduct[item.id_product] || [];
      const batch = batches.find((b) => b.id_product_batch === item.id_product_batch);
      if (!batch) return true;
      return Number(item.quantity) > Number(batch.batch_qty || 0);
    });
    if (exceedsSelectedBatch) {
      const batches = batchesByProduct[exceedsSelectedBatch.id_product] || [];
      const selected = batches.find((b) => b.id_product_batch === exceedsSelectedBatch.id_product_batch);       
      const available = Number(selected?.batch_qty || 0);
      setResultStatus("error"); setResultTitle("Validation Error"); setResultMessage(`Qty exceeds selected batch stock (${available}).`);
      setResultModalOpen(true); return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-out-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_user: userId,
          reason: manualReason,
          return_refund: manualReason === "RETURN_TO_SUPPLIER" ? manualReturnRefund === "YES" : undefined,      
          notes: manualNotes.trim(),
          items: manualItems.map((item) => ({ id_product: item.id_product, id_product_batch: item.id_product_batch || undefined, quantity: Number(item.quantity) })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to create non-sales stock out.");
      setFormOpen(false); setManualReason("DAMAGED"); setManualReturnRefund(""); setManualNotes(""); setManualItems([{ id_product: "", quantity: "" }]);
      loadRows(); setResultStatus("success"); setResultTitle("Action Completed"); setResultMessage("Non-sales stock out saved successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error"); setResultTitle("Action Failed"); setResultMessage(error instanceof Error ? error.message : "Failed to create non-sales stock out.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Stock Out"
        subtitle="Sales stock out is automatic. Use Add Stock Out for non-sales."
        action={
          <View style={styles.headerActionRow}>
            <ExportDropdownMenu
              onExportPdf={handlePrintStockOutTable}
              onExportExcel={() => Alert.alert("Export Excel", "This feature will be implemented soon.")}       
              onSendEmail={() => { setEmailTarget("table"); setEmailModalOpen(true); }}
            />
            {canInsert ? <PrimaryActionButton label="Add Stock Out" onPress={() => setFormOpen(true)} /> : null}
          </View>
        }
      />

      <InventoryFilterSection
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search stock out code or notes"
        onOpenFilter={() => { setDraftDateStartFilter(dateStartFilter); setDraftDateEndFilter(dateEndFilter); setDraftTypeFilter(typeFilter); setDraftProductFilter(productFilter); setDraftMinItemCountFilter(minItemCountFilter); setDraftMaxItemCountFilter(maxItemCountFilter); setDraftMinTotalQtyFilter(minTotalQtyFilter); setDraftMaxTotalQtyFilter(maxTotalQtyFilter); setDraftMinProfitFilter(minProfitFilter); setDraftMaxProfitFilter(maxProfitFilter); setFilterOpen(true); }}
        activeFilters={activeFilters}
        onClearAllFilters={() => { setTypeFilter("ALL"); setProductFilter("ALL"); setDateStartFilter(""); setDateEndFilter(""); setMinItemCountFilter(""); setMaxItemCountFilter(""); setMinTotalQtyFilter(""); setMaxTotalQtyFilter(""); setMinProfitFilter(""); setMaxProfitFilter(""); setDraftTypeFilter("ALL"); setDraftProductFilter("ALL"); setDraftDateStartFilter(""); setDraftDateEndFilter(""); setDraftMinItemCountFilter(""); setDraftMaxItemCountFilter(""); setDraftMinTotalQtyFilter(""); setDraftMaxTotalQtyFilter(""); setDraftMinProfitFilter(""); setDraftMaxProfitFilter(""); }}
      />

      <InventoryDataTable
        columns={tableColumns}
        rows={Array.isArray(filteredRows) ? filteredRows : []}
        rowKey={(row) => `${row.stock_out_type || "SALE"}-${row.id_stock_out}`}
        isRowActive={(row) => openActionStockOutId === row.id_stock_out}
        emptyText="No stock out documents found."
      />

      <FilterSheetModal
        title="Filter Stock Out"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            Alert.alert("Validation", "End date must be the same as or after Start date.");
            return;
          }
          setTypeFilter(draftTypeFilter);
          setProductFilter(draftProductFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setMinItemCountFilter(draftMinItemCountFilter);
          setMaxItemCountFilter(draftMaxItemCountFilter);
          setMinTotalQtyFilter(draftMinTotalQtyFilter);
          setMaxTotalQtyFilter(draftMaxTotalQtyFilter);
          setMinProfitFilter(draftMinProfitFilter);
          setMaxProfitFilter(draftMaxProfitFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftTypeFilter("ALL");
          setTypeFilter("ALL");
          setDraftProductFilter("ALL");
          setProductFilter("ALL");
          setDraftDateStartFilter("");
          setDateStartFilter("");
          setDraftDateEndFilter("");
          setDateEndFilter("");
          setDraftMinItemCountFilter("");
          setMinItemCountFilter("");
          setDraftMaxItemCountFilter("");
          setMaxItemCountFilter("");
          setDraftMinTotalQtyFilter("");
          setMinTotalQtyFilter("");
          setDraftMaxTotalQtyFilter("");
          setMaxTotalQtyFilter("");
          setDraftMinProfitFilter("");
          setMinProfitFilter("");
          setDraftMaxProfitFilter("");
          setMaxProfitFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Type"
          value={draftTypeFilter}
          options={typeOptions.map(opt => ({ label: opt, value: opt }))}
          onChange={setDraftTypeFilter}
        />
        <FilterSelectField
          label="Product"
          value={draftProductFilter}
          options={productFilterOptions.map(opt => ({ label: opt, value: opt }))}
          onChange={setDraftProductFilter}
        />
        <Text style={styles.filterLabel}>Stock Out Date Range</Text>
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
        <Text style={styles.filterLabel}>Item Count Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinItemCountFilter}
            onChangeText={(value) => setDraftMinItemCountFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Min items"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxItemCountFilter}
            onChangeText={(value) => setDraftMaxItemCountFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Max items"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
        <Text style={styles.filterLabel}>Total Qty Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinTotalQtyFilter}
            onChangeText={(value) => setDraftMinTotalQtyFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Min qty"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxTotalQtyFilter}
            onChangeText={(value) => setDraftMaxTotalQtyFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Max qty"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
        {draftTypeFilter === "SALE" ? (
          <>
            <Text style={styles.filterLabel}>Profit Range</Text>
            <View style={styles.rangeRow}>
              <TextInput
                value={draftMinProfitFilter}
                onChangeText={(value) => setDraftMinProfitFilter(value.replace(/[^0-9-]/g, ""))}
                placeholder="Min profit"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                style={styles.rangeInput}
              />
              <TextInput
                value={draftMaxProfitFilter}
                onChangeText={(value) => setDraftMaxProfitFilter(value.replace(/[^0-9-]/g, ""))}
                placeholder="Max profit"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                style={styles.rangeInput}
              />
            </View>
          </>
        ) : null}
      </FilterSheetModal>

      <ResponsiveModal visible={formOpen} onClose={() => (saving ? null : setFormOpen(false))} maxWidthDesktop={640} cardStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Non-Sales Stock Out</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField label="Reason" value={manualReason} options={MANUAL_REASONS.map((x) => ({ label: x, value: x }))} onChange={(value) => { setManualReason(value); if (value !== "RETURN_TO_SUPPLIER") setManualReturnRefund(""); }} />
              {manualReason === "RETURN_TO_SUPPLIER" ? <FilterSelectField label="Refund From Supplier" value={manualReturnRefund} options={[{ label: "Select refund status", value: "" }, { label: "Yes", value: "YES" }, { label: "No", value: "NO" }]} onChange={(value) => setManualReturnRefund(value as "" | "YES" | "NO")} /> : null}     
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput value={manualNotes} onChangeText={setManualNotes} placeholder="Required notes" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
              </View>
              {manualItems.map((item, index) => (
                <View key={`${index}-${item.id_product}`} style={styles.itemCard}>
                  <FilterSelectField
                    label={`Product #${index + 1}`}
                    value={item.id_product}
                    options={formProductOptions.filter((op) => op.value === item.id_product || !manualItems.some((x, i) => i !== index && x.id_product === op.value))}
                    onChange={(value) => setManualItems((prev) => prev.map((row, i) => {
                      if (i !== index) return row;
                      loadBatchesByProduct(value);
                      const nextMax = getProductAvailableQty(value);
                      return {
                        ...row,
                        id_product: value,
                        id_product_batch: "",
                        quantity: row.quantity && Number(row.quantity) > nextMax ? String(nextMax) : row.quantity,
                      };
                    }))}
                  />
                  <FilterSelectField
                    label="Batch (Optional)"
                    value={item.id_product_batch || ""}
                    options={[{ label: "Auto Allocation (FIFO/EXP)", value: "" }, ...((batchesByProduct[item.id_product] || []).filter((batch) => Number(batch.batch_qty || 0) > 0).map((batch) => ({ label: `${batch.batch_code} - Qty ${batch.batch_qty}${batch.expired_date ? ` - Exp ${new Date(batch.expired_date).toLocaleDateString("id-ID")}` : ""}`, value: batch.id_product_batch })))]}
                    onChange={(value) => setManualItems((prev) => prev.map((row, i) => {
                      if (i !== index) return row;
                      const nextMax = getSelectedBatchAvailableQty(row.id_product, value || undefined);
                      return {
                        ...row,
                        id_product_batch: value,
                        quantity: row.quantity && Number(row.quantity) > nextMax ? String(nextMax) : row.quantity,
                      };
                    }))}
                  />
                  <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>Qty</Text><TextInput value={item.quantity} onChangeText={(v) => setManualItems((prev) => prev.map((row, i) => { if (i !== index) return row; return { ...row, quantity: clampManualItemQuantity(row.id_product, row.id_product_batch, v) }; }))} keyboardType="numeric" placeholder={item.id_product ? `Max ${getSelectedBatchAvailableQty(item.id_product, item.id_product_batch)}` : "0"} placeholderTextColor="#94a3b8" style={styles.fieldInput} /></View>
                  {manualItems.length > 1 ? <Pressable style={styles.removeBtn} onPress={() => setManualItems((prev) => prev.filter((_, i) => i !== index))}><Text style={styles.removeBtnText}>Remove Row</Text></Pressable> : null}
                </View>
              ))}
              <PrimaryActionButton label="Add Product Row" onPress={() => setManualItems((prev) => [...prev, { id_product: "", quantity: "" }])} fullWidth />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => (saving ? null : setFormOpen(false))}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable>
              <Pressable style={styles.submitBtn} onPress={() => setConfirmOpen(true)} disabled={saving}><Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Stock Out"}</Text></Pressable>
            </View>
      </ResponsiveModal>

      <InventoryConfirmModal visible={confirmOpen} message="Create this stock out data?" onCancel={() => setConfirmOpen(false)} onConfirm={async () => { setConfirmOpen(false); await submitManualStockOut(); }} />
      <InventoryResultModal visible={resultModalOpen} status={resultStatus} title={resultTitle} message={resultMessage} onClose={() => setResultModalOpen(false)} />

      <ResponsiveModal visible={Boolean(selectedDoc)} onClose={() => setSelectedDoc(null)} maxWidthDesktop={980} cardStyle={styles.detailModalCard}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.modalTitle}>Stock Out Detail</Text>
              <ExportDropdownMenu
                variant="detail"
                onExportPdf={handlePrintStockOutDetail}
                onSendEmail={() => { setEmailTarget("detail"); setEmailModalOpen(true); }}
              />
            </View>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Stock Out Code</Text><Text style={styles.metaValue}>{selectedDoc?.stock_out_code || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Type</Text><Text style={styles.metaValue}>{displayText(selectedDoc?.stock_out_type || "-")}</Text></View>
              {String(selectedDoc?.stock_out_type || "SALE").toUpperCase() === "SALE" ? <View style={styles.metaItem}><Text style={styles.metaLabel}>Cashier</Text><Text style={styles.metaValue}>{selectedDoc?.cashier_name || "-"}</Text></View> : <View style={styles.metaItem}><Text style={styles.metaLabel}>Operator</Text><Text style={styles.metaValue}>{selectedDoc?.operator_name || "-"}</Text></View>}
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Date</Text><Text style={styles.metaValue}>{selectedDoc ? new Date(selectedDoc.stock_out_date).toLocaleString("id-ID") : "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Item Count</Text><Text style={styles.metaValue}>{selectedDoc?.items?.length || 0}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Total Qty</Text><Text style={styles.metaValue}>{selectedDoc?.total_qty || 0}</Text></View>
              {String(selectedDoc?.stock_out_type || "SALE").toUpperCase() !== "SALE" ? <View style={styles.metaItem}><Text style={styles.metaLabel}>Financial Impact</Text><Text style={styles.metaValue}>{isRefundStockOutType(selectedDoc?.stock_out_type) ? "Refund / No Loss" : "Loss"}</Text></View> : null}
              <View style={[styles.metaItem, styles.metaItemFull]}><Text style={styles.metaLabel}>Notes</Text><Text style={styles.metaValue}>{selectedDoc?.notes || "-"}</Text></View>
            </View>
            {String(selectedDoc?.stock_out_type || "SALE").toUpperCase() === "SALE" ? (
              <>
                <InventoryDataTable columns={saleDetailColumns} rows={selectedDoc?.items || []} rowKey={(item) => item.id_stock_movement} emptyText="No detail items." enablePagination={false} />
                <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Total Buy: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_buy || 0))}</Text></Text><Text style={styles.summaryLabel}>Total Sell: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_sell || 0))}</Text></Text><Text style={styles.summaryLabel}>Profit: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_profit || 0))}</Text></Text></View>
              </>
            ) : (
              <>
                <InventoryDataTable columns={isRefundStockOutType(selectedDoc?.stock_out_type) ? nonSaleRefundDetailColumns : nonSaleNoRefundDetailColumns} rows={selectedDoc?.items || []} rowKey={(item) => item.id_stock_movement} emptyText="No detail items." enablePagination={false} />
                <View style={styles.summaryCard}>{isRefundStockOutType(selectedDoc?.stock_out_type) ? <><Text style={styles.summaryLabel}>Total Refund: <Text style={styles.summaryValue}>{formatCurrency(Number((selectedDoc?.items || []).reduce((sum, item) => sum + Number(item.total_buy ?? (Number(item.buy_per_pcs || 0) * Number(item.quantity || 0))), 0)))}</Text></Text><Text style={styles.summaryLabel}>Profit: <Text style={styles.summaryValue}>{formatCurrency(0)}</Text></Text></> : <Text style={styles.summaryLabel}>Total Loss: <Text style={styles.summaryValue}>{formatCurrency(Number((selectedDoc?.items || []).reduce((sum, item) => sum + Number(item.total_buy ?? (Number(item.buy_per_pcs || 0) * Number(item.quantity || 0))), 0)))}</Text></Text>}</View>
              </>
            )}
            </ScrollView>
            <Pressable style={styles.closePrimaryBtn} onPress={() => setSelectedDoc(null)}><Text style={styles.closePrimaryBtnText}>Close</Text></Pressable>
      </ResponsiveModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "Stock Out List" : "Stock Out Detail"}
        onSend={handleSendEmailReport}
      />
    </ScrollView>

    <FilterSheetModal
      title="Filter Stock Out"
      visible={filterOpen}
      onApply={() => {
        const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
        if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
          Alert.alert("Validation", "End date must be the same as or after Start date.");
          return;
        }
        setTypeFilter(draftTypeFilter);
        setProductFilter(draftProductFilter);
        setDateStartFilter(draftDateStartFilter);
        setDateEndFilter(draftDateEndFilter);
        setMinItemCountFilter(draftMinItemCountFilter);
        setMaxItemCountFilter(draftMaxItemCountFilter);
        setMinTotalQtyFilter(draftMinTotalQtyFilter);
        setMaxTotalQtyFilter(draftMaxTotalQtyFilter);
        setMinProfitFilter(draftMinProfitFilter);
        setMaxProfitFilter(draftMaxProfitFilter);
        setFilterOpen(false);
      }}
      onReset={() => {
        setDraftTypeFilter("ALL");
        setTypeFilter("ALL");
        setDraftProductFilter("ALL");
        setProductFilter("ALL");
        setDraftDateStartFilter("");
        setDateStartFilter("");
        setDraftDateEndFilter("");
        setDateEndFilter("");
        setDraftMinItemCountFilter("");
        setMinItemCountFilter("");
        setDraftMaxItemCountFilter("");
        setMaxItemCountFilter("");
        setDraftMinTotalQtyFilter("");
        setMinTotalQtyFilter("");
        setDraftMaxTotalQtyFilter("");
        setMaxTotalQtyFilter("");
        setDraftMinProfitFilter("");
        setMinProfitFilter("");
        setDraftMaxProfitFilter("");
        setMaxProfitFilter("");
      }}
      onClose={() => setFilterOpen(false)}
    >
      <FilterSelectField
        label="Type"
        value={draftTypeFilter}
        options={typeOptions.map(opt => ({ label: opt, value: opt }))}
        onChange={setDraftTypeFilter}
      />
      <FilterSelectField
        label="Product"
        value={draftProductFilter}
        options={productFilterOptions.map(opt => ({ label: opt, value: opt }))}
        onChange={setDraftProductFilter}
      />
      <Text style={styles.filterLabel}>Stock Out Date Range</Text>
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
      <Text style={styles.filterLabel}>Item Count Range</Text>
      <View style={styles.rangeRow}>
        <TextInput
          value={draftMinItemCountFilter}
          onChangeText={(value) => setDraftMinItemCountFilter(value.replace(/[^0-9]/g, ""))}
          placeholder="Min items"
          keyboardType="numeric"
          placeholderTextColor="#94a3b8"
          style={styles.rangeInput}
        />
        <TextInput
          value={draftMaxItemCountFilter}
          onChangeText={(value) => setDraftMaxItemCountFilter(value.replace(/[^0-9]/g, ""))}
          placeholder="Max items"
          keyboardType="numeric"
          placeholderTextColor="#94a3b8"
          style={styles.rangeInput}
        />
      </View>
      <Text style={styles.filterLabel}>Total Qty Range</Text>
      <View style={styles.rangeRow}>
        <TextInput
          value={draftMinTotalQtyFilter}
          onChangeText={(value) => setDraftMinTotalQtyFilter(value.replace(/[^0-9]/g, ""))}
          placeholder="Min qty"
          keyboardType="numeric"
          placeholderTextColor="#94a3b8"
          style={styles.rangeInput}
        />
        <TextInput
          value={draftMaxTotalQtyFilter}
          onChangeText={(value) => setDraftMaxTotalQtyFilter(value.replace(/[^0-9]/g, ""))}
          placeholder="Max qty"
          keyboardType="numeric"
          placeholderTextColor="#94a3b8"
          style={styles.rangeInput}
        />
      </View>
      {draftTypeFilter === "SALE" ? (
        <>
          <Text style={styles.filterLabel}>Profit Range</Text>
          <View style={styles.rangeRow}>
            <TextInput
              value={draftMinProfitFilter}
              onChangeText={(value) => setDraftMinProfitFilter(value.replace(/[^0-9-]/g, ""))}
              placeholder="Min profit"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
              style={styles.rangeInput}
            />
            <TextInput
              value={draftMaxProfitFilter}
              onChangeText={(value) => setDraftMaxProfitFilter(value.replace(/[^0-9-]/g, ""))}
              placeholder="Max profit"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
              style={styles.rangeInput}
            />
          </View>
        </>
      ) : null}
    </FilterSheetModal>
  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, color: "#0f172a" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "34%" }, colType: { width: "18%" }, colQty: { width: "12%" }, colDate: { width: "20%" }, colAction: { width: "16%", textAlign: "center" },
  actionWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionWrapOpen: { position: "relative", zIndex: 4000 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  detailModalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  formBody: { gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  fieldInput: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  itemCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, gap: 8, backgroundColor: "#f8fafc" },
  removeBtn: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  removeBtnText: { color: "#b91c1c", fontSize: 12, fontWeight: "700" },
  modalActions: { borderTopWidth: 1, borderTopColor: "#eef2f7", padding: 12, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  metaItem: { width: "49%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  metaItemFull: { width: "100%" },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  detailHeadCell: { fontSize: 11, fontWeight: "700", color: "#334155", paddingHorizontal: 8 },
  detailRowCell: { fontSize: 11, color: "#0f172a", paddingHorizontal: 8 },
  summaryCard: { borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", padding: 10, gap: 4 },
  summaryLabel: { color: "#334155", fontSize: 12, fontWeight: "600" },
  summaryValue: { color: "#0f172a", fontWeight: "800" },
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closePrimaryBtn: { marginTop: 6, minHeight: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closePrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
