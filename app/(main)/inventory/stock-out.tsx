import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import DatePickerField from "../../../components/inventory/DatePickerField";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import { API_BASE_URL } from "../../../utils/api";
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

type DraftItem = { id_product: string; quantity: string };

const MANUAL_REASONS = ["DAMAGED", "EXPIRED", "RETURN_TO_SUPPLIER", "LOST", "DONATION", "OTHER"];
const formatCurrency = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

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

  const canInsert = canInsertStockMovement(roleName);

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
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setProducts(safeRows.filter((item) => item?.is_active !== "N"));
      })
      .catch(() => setProducts([]));
  }, []);

  const typeOptions = useMemo(() => {
    const types = rows.map((item) => String(item.stock_out_type || "SALE").toUpperCase()).filter(Boolean);
    return ["ALL", ...Array.from(new Set(types)).sort()];
  }, [rows]);

  const productOptions = useMemo(() => {
    const sourceRows = draftTypeFilter === "ALL" ? rows : rows.filter((row) => String(row.stock_out_type || "SALE").toUpperCase() === draftTypeFilter);
    const names = sourceRows.flatMap((row) => (Array.isArray(row.product_names) ? row.product_names : [])).filter(Boolean);
    return ["ALL", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))];
  }, [rows, draftTypeFilter]);

  const formProductOptions = useMemo(
    () =>
      products
        .filter((item) => Number(item.available_stock || 0) > 0)
        .map((item) => ({
          label: `${item.product_name} (${item.product_code}) - Stock ${item.available_stock}`,
          value: item.id_product,
        })),
    [products]
  );
  const stockByProductId = useMemo(
    () =>
      products.reduce<Record<string, number>>((acc, item) => {
        acc[item.id_product] = Number(item.available_stock || 0);
        return acc;
      }, {}),
    [products]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minItemCount = Number(minItemCountFilter || "0");
    const maxItemCount = Number(maxItemCountFilter || "0");
    const minTotalQty = Number(minTotalQtyFilter || "0");
    const maxTotalQty = Number(maxTotalQtyFilter || "0");
    const minProfit = Number(minProfitFilter || "0");
    const maxProfit = Number(maxProfitFilter || "0");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;
    return rows.filter((item) => {
      const itemDate = item.stock_out_date ? new Date(item.stock_out_date) : null;
      const productsName = Array.isArray(item.product_names) ? item.product_names : [];
      const itemType = String(item.stock_out_type || "SALE").toUpperCase();
      const text = `${item.stock_out_code} ${item.notes || ""} ${productsName.join(" ")} ${item.cashier_name || ""} ${item.operator_name || ""}`.toLowerCase();
      const matchSearch = !query || text.includes(query);
      const matchType = typeFilter === "ALL" ? true : itemType === typeFilter;
      const matchProduct = productFilter === "ALL" ? true : productsName.includes(productFilter);
      const matchItemCountMin = minItemCountFilter.trim() ? item.item_count >= minItemCount : true;
      const matchItemCountMax = maxItemCountFilter.trim() ? item.item_count <= maxItemCount : true;
      const matchTotalQtyMin = minTotalQtyFilter.trim() ? item.total_qty >= minTotalQty : true;
      const matchTotalQtyMax = maxTotalQtyFilter.trim() ? item.total_qty <= maxTotalQty : true;
      const matchProfitMin = itemType === "SALE" && minProfitFilter.trim() ? Number(item.total_profit || 0) >= minProfit : true;
      const matchProfitMax = itemType === "SALE" && maxProfitFilter.trim() ? Number(item.total_profit || 0) <= maxProfit : true;
      const matchStartDate = startDate && itemDate ? itemDate >= startDate : true;
      const matchEndDate = endDate && itemDate ? itemDate <= endDate : true;
      return matchSearch && matchType && matchProduct && matchItemCountMin && matchItemCountMax && matchTotalQtyMin && matchTotalQtyMax && matchProfitMin && matchProfitMax && matchStartDate && matchEndDate;
    });
  }, [rows, search, typeFilter, productFilter, minItemCountFilter, maxItemCountFilter, minTotalQtyFilter, maxTotalQtyFilter, minProfitFilter, maxProfitFilter, dateStartFilter, dateEndFilter]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (typeFilter !== "ALL") items.push({ key: "type", label: "Type", value: typeFilter, onClear: () => setTypeFilter("ALL") });
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (dateStartFilter) items.push({ key: "start", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (dateEndFilter) items.push({ key: "end", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minItemCountFilter) items.push({ key: "minItems", label: "Min Items", value: minItemCountFilter, onClear: () => setMinItemCountFilter("") });
    if (maxItemCountFilter) items.push({ key: "maxItems", label: "Max Items", value: maxItemCountFilter, onClear: () => setMaxItemCountFilter("") });
    if (minTotalQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minTotalQtyFilter, onClear: () => setMinTotalQtyFilter("") });
    if (maxTotalQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxTotalQtyFilter, onClear: () => setMaxTotalQtyFilter("") });
    if (minProfitFilter) items.push({ key: "minProfit", label: "Min Profit", value: minProfitFilter, onClear: () => setMinProfitFilter("") });
    if (maxProfitFilter) items.push({ key: "maxProfit", label: "Max Profit", value: maxProfitFilter, onClear: () => setMaxProfitFilter("") });
    return items;
  }, [typeFilter, productFilter, dateStartFilter, dateEndFilter, minItemCountFilter, maxItemCountFilter, minTotalQtyFilter, maxTotalQtyFilter, minProfitFilter, maxProfitFilter]);

  const openDetail = async (row: StockOutDocument) => {
    const type = String(row.stock_out_type || "SALE").toUpperCase();
    const endpoint =
      type === "SALE"
        ? `${API_BASE_URL}/api/stock-out-documents/${row.id_stock_out}`
        : `${API_BASE_URL}/api/stock-out-manual-documents/${row.id_stock_out}`;
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
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("User session was not found. Please sign in again.");
      setResultModalOpen(true);
      return;
    }
    if (manualReason === "RETURN_TO_SUPPLIER" && !manualReturnRefund) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Please choose refund status for RETURN_TO_SUPPLIER.");
      setResultModalOpen(true);
      return;
    }
    if (!manualNotes.trim()) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Notes are required.");
      setResultModalOpen(true);
      return;
    }
    const invalid = manualItems.some((item) => !item.id_product || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0);
    if (invalid) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Each row must have a selected product and qty > 0.");
      setResultModalOpen(true);
      return;
    }
    const exceedsStock = manualItems.find((item) => Number(item.quantity) > Number(stockByProductId[item.id_product] || 0));
    if (exceedsStock) {
      const maxStock = Number(stockByProductId[exceedsStock.id_product] || 0);
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage(`Qty cannot exceed current stock (${maxStock}).`);
      setResultModalOpen(true);
      return;
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
          items: manualItems.map((item) => ({ id_product: item.id_product, quantity: Number(item.quantity) })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to create non-sales stock out.");
      setFormOpen(false);
      setManualReason("DAMAGED");
      setManualReturnRefund("");
      setManualNotes("");
      setManualItems([{ id_product: "", quantity: "" }]);
      loadRows();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage("Non-sales stock out saved successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to create non-sales stock out.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Stock Out</Text>
          <Text style={styles.subtitle}>Sales stock out is automatic. Use Add Stock Out for non-sales.</Text>
        </View>
        {canInsert ? (
          <PrimaryActionButton label="Add Stock Out" onPress={() => setFormOpen(true)} />
        ) : null}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search stock out code or notes" placeholderTextColor="#94a3b8" style={styles.searchInput} />
          <IconFilterButton
            onPress={() => {
              setDraftDateStartFilter(dateStartFilter);
              setDraftDateEndFilter(dateEndFilter);
              setDraftTypeFilter(typeFilter);
              setDraftProductFilter(productFilter);
              setDraftMinItemCountFilter(minItemCountFilter);
              setDraftMaxItemCountFilter(maxItemCountFilter);
              setDraftMinTotalQtyFilter(minTotalQtyFilter);
              setDraftMaxTotalQtyFilter(maxTotalQtyFilter);
              setDraftMinProfitFilter(minProfitFilter);
              setDraftMaxProfitFilter(maxProfitFilter);
              setFilterOpen(true);
            }}
          />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setTypeFilter("ALL");
            setProductFilter("ALL");
            setDateStartFilter("");
            setDateEndFilter("");
            setMinItemCountFilter("");
            setMaxItemCountFilter("");
            setMinTotalQtyFilter("");
            setMaxTotalQtyFilter("");
            setMinProfitFilter("");
            setMaxProfitFilter("");
            setDraftTypeFilter("ALL");
            setDraftProductFilter("ALL");
            setDraftDateStartFilter("");
            setDraftDateEndFilter("");
            setDraftMinItemCountFilter("");
            setDraftMaxItemCountFilter("");
            setDraftMinTotalQtyFilter("");
            setDraftMaxTotalQtyFilter("");
            setDraftMinProfitFilter("");
            setDraftMaxProfitFilter("");
          }}
        />
      </View>

      <FilterSheetModal
        title="Filter Stock Out"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            Alert.alert("Validation", "End date must be the same as or after Start date.");
            return;
          }
          if (draftTypeFilter !== "SALE") {
            setDraftMinProfitFilter("");
            setDraftMaxProfitFilter("");
          }
          if (draftTypeFilter === "SALE" && draftMinProfitFilter.trim() && draftMaxProfitFilter.trim() && Number(draftMaxProfitFilter) < Number(draftMinProfitFilter)) {
            Alert.alert("Validation", "Max profit must be greater than or equal to Min profit.");
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
          setMinProfitFilter(draftTypeFilter === "SALE" ? draftMinProfitFilter : "");
          setMaxProfitFilter(draftTypeFilter === "SALE" ? draftMaxProfitFilter : "");
          setFilterOpen(false);
        }}
        onReset={() => {
          setTypeFilter("ALL"); setProductFilter("ALL");
          setDateStartFilter(""); setDateEndFilter("");
          setMinItemCountFilter(""); setMaxItemCountFilter("");
          setMinTotalQtyFilter(""); setMaxTotalQtyFilter("");
          setMinProfitFilter(""); setMaxProfitFilter("");
          setDraftTypeFilter("ALL"); setDraftProductFilter("ALL");
          setDraftDateStartFilter(""); setDraftDateEndFilter("");
          setDraftMinItemCountFilter(""); setDraftMaxItemCountFilter("");
          setDraftMinTotalQtyFilter(""); setDraftMaxTotalQtyFilter("");
          setDraftMinProfitFilter(""); setDraftMaxProfitFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField label="Type" value={draftTypeFilter} options={typeOptions.map((x) => ({ label: x, value: x }))} onChange={setDraftTypeFilter} />
        <FilterSelectField label="Product" value={draftProductFilter} options={productOptions.map((x) => ({ label: x, value: x }))} onChange={setDraftProductFilter} />
        <Text style={styles.filterLabel}>Stock Out Date Range</Text>
        <View style={styles.rangeRow}>
          <View style={styles.dateFieldWrap}>
            <DatePickerField label="Start Date" value={draftDateStartFilter} placeholder="Select start date" onChange={setDraftDateStartFilter} maximumDate={draftDateEndFilter ? new Date(`${draftDateEndFilter}T00:00:00`) : undefined} />
          </View>
          <View style={styles.dateFieldWrap}>
            <DatePickerField label="End Date" value={draftDateEndFilter} placeholder="Select end date" onChange={setDraftDateEndFilter} minimumDate={draftDateStartFilter ? new Date(`${draftDateStartFilter}T00:00:00`) : undefined} />
          </View>
        </View>
        <Text style={styles.filterLabel}>Item Count Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinItemCountFilter} onChangeText={(v) => setDraftMinItemCountFilter(v.replace(/[^0-9]/g, ""))} placeholder="Min items" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxItemCountFilter} onChangeText={(v) => setDraftMaxItemCountFilter(v.replace(/[^0-9]/g, ""))} placeholder="Max items" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
        <Text style={styles.filterLabel}>Total Qty Range</Text>
        <View style={styles.rangeRow}>
          <TextInput value={draftMinTotalQtyFilter} onChangeText={(v) => setDraftMinTotalQtyFilter(v.replace(/[^0-9]/g, ""))} placeholder="Min qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
          <TextInput value={draftMaxTotalQtyFilter} onChangeText={(v) => setDraftMaxTotalQtyFilter(v.replace(/[^0-9]/g, ""))} placeholder="Max qty" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
        </View>
        {draftTypeFilter === "SALE" ? (
          <>
            <Text style={styles.filterLabel}>Profit Range</Text>
            <View style={styles.rangeRow}>
              <TextInput value={draftMinProfitFilter} onChangeText={(v) => setDraftMinProfitFilter(v.replace(/[^0-9]/g, ""))} placeholder="Min profit" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
              <TextInput value={draftMaxProfitFilter} onChangeText={(v) => setDraftMaxProfitFilter(v.replace(/[^0-9]/g, ""))} placeholder="Max profit" keyboardType="numeric" placeholderTextColor="#94a3b8" style={styles.rangeInput} />
            </View>
          </>
        ) : null}
      </FilterSheetModal>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headCell, styles.colCode]}>Stock Out Code</Text>
          <Text style={[styles.headCell, styles.colType]}>Type</Text>
          <Text style={[styles.headCell, styles.colQty]}>Total Qty</Text>
          <Text style={[styles.headCell, styles.colDate]}>Date</Text>
          <Text style={[styles.headCell, styles.colAction]}>Action</Text>
        </View>
        {(Array.isArray(filteredRows) ? filteredRows : []).map((row) => (
          <View key={`${row.stock_out_type}-${row.id_stock_out}`} style={[styles.tableRow, openActionStockOutId === row.id_stock_out && styles.tableRowActiveLayer]}>
            <Text style={[styles.rowCell, styles.colCode]} numberOfLines={1}>{row.stock_out_code}</Text>
            <Text style={[styles.rowCell, styles.colType]} numberOfLines={1}>{displayText(row.stock_out_type || "SALE")}</Text>
            <Text style={[styles.rowCell, styles.colQty]}>{row.total_qty}</Text>
            <Text style={[styles.rowCell, styles.colDate]}>{new Date(row.stock_out_date).toLocaleString("id-ID")}</Text>
            <View style={[styles.colAction, styles.actionWrap]}>
              <View style={styles.actionDropdownWrap}>
                <Pressable style={styles.actionMenuButton} onPress={() => setOpenActionStockOutId((prev) => (prev === row.id_stock_out ? null : row.id_stock_out))}>
                  <Text style={styles.actionMenuButtonText}>Actions</Text>
                </Pressable>
                {openActionStockOutId === row.id_stock_out ? (
                  <View style={styles.actionMenu}>
                    <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionStockOutId(null); openDetail(row); }}>
                      <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}
        {filteredRows.length === 0 ? <Text style={styles.emptyText}>No stock out documents found.</Text> : null}
      </View>

      <ResponsiveModal
        visible={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        maxWidthDesktop={640}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.82}
        cardStyle={styles.modalCard}
      >
            <Text style={styles.modalTitle}>Add Non-Sales Stock Out</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField
                label="Reason"
                value={manualReason}
                options={MANUAL_REASONS.map((x) => ({ label: x, value: x }))}
                onChange={(value) => {
                  setManualReason(value);
                  if (value !== "RETURN_TO_SUPPLIER") setManualReturnRefund("");
                }}
              />
              {manualReason === "RETURN_TO_SUPPLIER" ? (
                <FilterSelectField
                  label="Refund From Supplier"
                  value={manualReturnRefund}
                  options={[
                    { label: "Select refund status", value: "" },
                    { label: "Yes", value: "YES" },
                    { label: "No", value: "NO" },
                  ]}
                  onChange={(value) => setManualReturnRefund(value as "" | "YES" | "NO")}
                />
              ) : null}
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
                    onChange={(value) =>
                      setManualItems((prev) =>
                        prev.map((row, i) => {
                          if (i !== index) return row;
                          const nextStock = Number(stockByProductId[value] || 0);
                          const nextQty =
                            row.quantity && Number(row.quantity) > nextStock ? String(nextStock) : row.quantity;
                          return { ...row, id_product: value, quantity: nextQty };
                        })
                      )
                    }
                  />
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(v) =>
                        setManualItems((prev) =>
                          prev.map((row, i) => {
                            if (i !== index) return row;
                          const digits = v.replace(/[^0-9]/g, "");
                          const maxStock = Number(stockByProductId[row.id_product] || 0);
                          if (!digits) return { ...row, quantity: "" };
                          if (!row.id_product) return { ...row, quantity: digits };
                          const clamped = Math.min(Number(digits), maxStock);
                          return { ...row, quantity: String(clamped) };
                        })
                      )
                      }
                      keyboardType="numeric"
                      placeholder={item.id_product ? `Max ${Number(stockByProductId[item.id_product] || 0)}` : "0"}
                      placeholderTextColor="#94a3b8"
                      style={styles.fieldInput}
                    />
                  </View>
                  {manualItems.length > 1 ? <Pressable style={styles.removeBtn} onPress={() => setManualItems((prev) => prev.filter((_, i) => i !== index))}><Text style={styles.removeBtnText}>Remove Row</Text></Pressable> : null}
                </View>
              ))}
              <PrimaryActionButton
                label="Add Product Row"
                onPress={() => setManualItems((prev) => [...prev, { id_product: "", quantity: "" }])}
                fullWidth
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => (saving ? null : setFormOpen(false))}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable>
              <Pressable style={styles.submitBtn} onPress={() => setConfirmOpen(true)} disabled={saving}><Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Stock Out"}</Text></Pressable>
            </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidthDesktop={420}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.84}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.confirmModalCard}
      >
        <Text style={styles.modalTitle}>Please Confirm</Text>
        <Text style={styles.confirmText}>Create this stock out data?</Text>
        <View style={styles.confirmActionRow}>
          <Pressable style={styles.cancelBtn} onPress={() => setConfirmOpen(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.submitBtn} onPress={async () => { setConfirmOpen(false); await submitManualStockOut(); }}>
            <Text style={styles.submitBtnText}>Yes, Continue</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        maxWidthDesktop={380}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.82}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.resultModalCard}
      >
        <Feather name={resultStatus === "success" ? "check-circle" : "x-circle"} size={42} color={resultStatus === "success" ? "#16a34a" : "#dc2626"} />
        <Text style={styles.resultTitle}>{resultTitle}</Text>
        <Text style={styles.resultMessage}>{resultMessage}</Text>
        <Pressable style={styles.resultCloseBtn} onPress={() => setResultModalOpen(false)}>
          <Text style={styles.resultCloseBtnText}>OK</Text>
        </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.detailModalCard}
      >
            <Text style={styles.modalTitle}>Stock Out Detail</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Stock Out Code</Text><Text style={styles.metaValue}>{selectedDoc?.stock_out_code || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Type</Text><Text style={styles.metaValue}>{displayText(selectedDoc?.stock_out_type || "-")}</Text></View>
              {String(selectedDoc?.stock_out_type || "SALE").toUpperCase() === "SALE" ? (
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Cashier</Text><Text style={styles.metaValue}>{selectedDoc?.cashier_name || "-"}</Text></View>
              ) : (
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Operator</Text><Text style={styles.metaValue}>{selectedDoc?.operator_name || "-"}</Text></View>
              )}
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Date</Text><Text style={styles.metaValue}>{selectedDoc ? new Date(selectedDoc.stock_out_date).toLocaleString("id-ID") : "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Item Count</Text><Text style={styles.metaValue}>{selectedDoc?.items?.length || 0}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Total Qty</Text><Text style={styles.metaValue}>{selectedDoc?.total_qty || 0}</Text></View>
              <View style={[styles.metaItem, styles.metaItemFull]}><Text style={styles.metaLabel}>Notes</Text><Text style={styles.metaValue}>{selectedDoc?.notes || "-"}</Text></View>
            </View>
            {String(selectedDoc?.stock_out_type || "SALE").toUpperCase() === "SALE" ? (
              <>
                <View style={styles.detailTableCard}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.detailInnerWide}>
                      <View style={styles.detailTableHeader}>
                        <Text style={[styles.detailHeadCell, styles.detailColProduct]}>Product</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColBatch]}>Batch</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColQty]}>Qty</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColMoney]}>Buy/Pcs</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColMoney]}>Sell/Pcs</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColMoney]}>Total Buy</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColMoney]}>Total Sell</Text>
                        <Text style={[styles.detailHeadCell, styles.detailColMoney]}>Profit</Text>
                      </View>
                      {(selectedDoc?.items || []).map((item) => (
                        <View key={item.id_stock_movement} style={styles.detailTableRow}>
                          <Text style={[styles.detailRowCell, styles.detailColProduct]} numberOfLines={1}>{item.product_name}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColBatch]} numberOfLines={1}>{item.batch_code || "-"}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColQty]}>{item.quantity}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColMoney]}>{formatCurrency(Number(item.buy_per_pcs || 0))}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColMoney]}>{formatCurrency(Number(item.sell_per_pcs || 0))}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColMoney]}>{formatCurrency(Number(item.total_buy || 0))}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColMoney]}>{formatCurrency(Number(item.total_sell || 0))}</Text>
                          <Text style={[styles.detailRowCell, styles.detailColMoney]}>{formatCurrency(Number(item.profit || 0))}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Buy: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_buy || 0))}</Text></Text>
                  <Text style={styles.summaryLabel}>Total Sell: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_sell || 0))}</Text></Text>
                  <Text style={styles.summaryLabel}>Profit: <Text style={styles.summaryValue}>{formatCurrency(Number(selectedDoc?.total_profit || 0))}</Text></Text>
                </View>
              </>
            ) : (
              <View style={styles.detailTableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.detailInnerNarrow}>
                    <View style={styles.detailTableHeader}>
                      <Text style={[styles.detailHeadCell, styles.nonSaleColProduct]}>Product</Text>
                      <Text style={[styles.detailHeadCell, styles.nonSaleColBatch]}>Batch</Text>
                      <Text style={[styles.detailHeadCell, styles.nonSaleColQty]}>Qty</Text>
                      <Text style={[styles.detailHeadCell, styles.nonSaleColReason]}>Reason</Text>
                    </View>
                    {(selectedDoc?.items || []).map((item) => (
                      <View key={item.id_stock_movement} style={styles.detailTableRow}>
                        <Text style={[styles.detailRowCell, styles.nonSaleColProduct]} numberOfLines={1}>{item.product_name}</Text>
                        <Text style={[styles.detailRowCell, styles.nonSaleColBatch]} numberOfLines={1}>{item.batch_code || "-"}</Text>
                        <Text style={[styles.detailRowCell, styles.nonSaleColQty]}>{item.quantity}</Text>
                        <Text style={[styles.detailRowCell, styles.nonSaleColReason]} numberOfLines={1}>{displayText(String(item.reason || "").replace("NON_SALE_OUT:", ""))}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            </ScrollView>
            <Pressable style={styles.closePrimaryBtn} onPress={() => setSelectedDoc(null)}>
              <Text style={styles.closePrimaryBtnText}>Close</Text>
            </Pressable>
      </ResponsiveModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 30, color: "#0f2852", fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13 },
  filterCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", paddingHorizontal: 12, color: "#0f172a" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 10, color: "#0f172a" },
  tableCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "visible" },
  tableHeader: { minHeight: 42, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7", position: "relative", zIndex: 1 },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "34%" }, colType: { width: "18%" }, colQty: { width: "12%" }, colDate: { width: "20%" }, colAction: { width: "16%", textAlign: "center" },
  actionWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionDropdownWrap: { position: "relative", alignItems: "flex-end" },
  actionMenuButton: { minHeight: 28, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionMenuButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  actionMenu: { position: "absolute", top: 30, right: 0, minWidth: 132, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#dbe3ee", padding: 6, gap: 6, zIndex: 50, elevation: 6 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  emptyText: { color: "#64748b", fontSize: 12, padding: 12 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  detailModalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
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
  detailTableCard: { borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  detailInnerWide: { width: "100%", minWidth: 1180 },
  detailInnerNarrow: { width: "100%", minWidth: 860 },
  detailTableHeader: { minHeight: 38, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  detailTableRow: { minHeight: 38, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  detailHeadCell: { fontSize: 11, fontWeight: "700", color: "#334155", paddingHorizontal: 8 },
  detailRowCell: { fontSize: 11, color: "#0f172a", paddingHorizontal: 8 },
  detailColProduct: { width: "18%" },
  detailColBatch: { width: "16%" },
  detailColQty: { width: "7%" },
  detailColMoney: { width: "11.83%" },
  nonSaleColProduct: { width: "32%" },
  nonSaleColBatch: { width: "26%" },
  nonSaleColQty: { width: "10%" },
  nonSaleColReason: { width: "32%" },
  summaryCard: { borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", padding: 10, gap: 4 },
  summaryLabel: { color: "#334155", fontSize: 12, fontWeight: "600" },
  summaryValue: { color: "#0f172a", fontWeight: "800" },
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closePrimaryBtn: { marginTop: 6, minHeight: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closePrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  confirmModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  confirmText: { color: "#334155", fontSize: 13, lineHeight: 20 },
  confirmActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  resultModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10 },
  resultTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  resultMessage: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  resultCloseBtn: { marginTop: 4, width: "100%", height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  resultCloseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
