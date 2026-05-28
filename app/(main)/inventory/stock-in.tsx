import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import StockInFormModal from "../../../components/inventory/StockInFormModal";
import DatePickerField from "../../../components/inventory/DatePickerField";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import { API_BASE_URL } from "../../../utils/api";
import { canInsertStockMovement, getAuthSession, normalizeRole } from "../../../utils/authSession";

type StockInDocument = {
  id_stock_in: string;
  stock_in_code: string;
  stock_in_date: string;
  notes: string | null;
  supplier_name: string;
  received_by_name?: string;
  product_names?: string[];
  item_count: number;
  total_qty: number;
};

type StockInDocumentItem = {
  id_stock_in_item: string;
  product_code: string;
  product_name: string;
  batch_code: string | null;
  purchase_price: number | null;
  quantity: number;
  expired_date: string;
};

type StockInDetail = {
  id_stock_in: string;
  stock_in_code: string;
  stock_in_date: string;
  notes: string | null;
  supplier_name: string;
  received_by_name?: string;
  items: StockInDocumentItem[];
};

type Supplier = {
  id_supplier: string;
  supplier_name: string;
  is_active: string;
};

type SupplierProduct = {
  id_product: string;
  product_code: string;
  product_name: string;
  is_active: string;
};

type DraftItem = {
  id_product: string;
  quantity: string;
  expired_date: string;
  purchase_price: string;
};

export default function StockInScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 960;
  const [rows, setRows] = useState<StockInDocument[]>([]);
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ id_product: "", quantity: "", expired_date: "", purchase_price: "" }]);
  const [selectedDoc, setSelectedDoc] = useState<StockInDetail | null>(null);
  const [openActionStockInId, setOpenActionStockInId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [draftSupplierFilter, setDraftSupplierFilter] = useState("ALL");
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
  const [filterOpen, setFilterOpen] = useState(false);
  const tomorrowDate = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);
  const todayDayNumber = useMemo(() => Number(new Date().toISOString().slice(0, 10).replaceAll("-", "")), []);

  const canInsert = canInsertStockMovement(roleName);

  const loadRows = () => {
    fetch(`${API_BASE_URL}/api/stock-in-documents`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setRows(safeRows as StockInDocument[]);
      })
      .catch(() => setRows([]));
  };

  const openDetail = async (idStockIn: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-in-documents/${idStockIn}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to fetch stock in detail.");
      }
      setSelectedDoc(payload?.data || null);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to fetch stock in detail.");
    }
  };

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
        setUserId(session?.user?.id_user || "");
      })
      .catch(() => setRoleName("CASHIER"));
    loadRows();
    fetch(`${API_BASE_URL}/api/suppliers`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setSuppliers(safeRows.filter((item) => item?.is_active === "Y"));
      })
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    if (!selectedSupplierId) {
      setProducts([]);
      return;
    }

    fetch(`${API_BASE_URL}/api/suppliers/${selectedSupplierId}/products`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setProducts(safeRows.filter((item) => item?.is_active === "Y"));
      })
      .catch(() => setProducts([]));
  }, [selectedSupplierId]);

  const hasInvalidRows = useMemo(
    () =>
      items.some(
        (item) =>
          !item.id_product ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          !Number.isFinite(Number(item.purchase_price)) ||
          Number(item.purchase_price) <= 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(String(item.expired_date || "")) ||
          Number(String(item.expired_date || "").replaceAll("-", "")) <= todayDayNumber
      ),
    [items, todayDayNumber]
  );

  const supplierOptions = useMemo(() => {
    const names = rows.map((item) => item.supplier_name).filter(Boolean);
    return ["ALL", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const productOptions = useMemo(() => {
    const sourceRows =
      draftSupplierFilter === "ALL" ? rows : rows.filter((row) => row.supplier_name === draftSupplierFilter);
    const names = sourceRows.flatMap((row) => (Array.isArray(row.product_names) ? row.product_names : [])).filter(Boolean);
    return ["ALL", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))];
  }, [rows, draftSupplierFilter]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minItemCount = Number(minItemCountFilter || "0");
    const maxItemCount = Number(maxItemCountFilter || "0");
    const minTotalQty = Number(minTotalQtyFilter || "0");
    const maxTotalQty = Number(maxTotalQtyFilter || "0");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;
    return rows.filter((item) => {
      const itemDate = item.stock_in_date ? new Date(item.stock_in_date) : null;
      const itemProducts = Array.isArray(item.product_names) ? item.product_names : [];
      const matchSearch =
        !query ||
        `${item.stock_in_code} ${item.supplier_name} ${item.notes || ""} ${itemProducts.join(" ")}`.toLowerCase().includes(query);
      const matchSupplier = supplierFilter === "ALL" ? true : item.supplier_name === supplierFilter;
      const matchProduct = productFilter === "ALL" ? true : itemProducts.includes(productFilter);
      const matchItemCountMin = minItemCountFilter.trim() ? item.item_count >= minItemCount : true;
      const matchItemCountMax = maxItemCountFilter.trim() ? item.item_count <= maxItemCount : true;
      const matchTotalQtyMin = minTotalQtyFilter.trim() ? item.total_qty >= minTotalQty : true;
      const matchTotalQtyMax = maxTotalQtyFilter.trim() ? item.total_qty <= maxTotalQty : true;
      const matchStartDate = startDate && itemDate ? itemDate >= startDate : true;
      const matchEndDate = endDate && itemDate ? itemDate <= endDate : true;
      return (
        matchSearch &&
        matchSupplier &&
        matchProduct &&
        matchItemCountMin &&
        matchItemCountMax &&
        matchTotalQtyMin &&
        matchTotalQtyMax &&
        matchStartDate &&
        matchEndDate
      );
    });
  }, [
    rows,
    search,
    supplierFilter,
    productFilter,
    minItemCountFilter,
    maxItemCountFilter,
    minTotalQtyFilter,
    maxTotalQtyFilter,
    dateStartFilter,
    dateEndFilter,
  ]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (supplierFilter !== "ALL") items.push({ key: "supplier", label: "Supplier", value: supplierFilter, onClear: () => setSupplierFilter("ALL") });
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (dateStartFilter) items.push({ key: "dateStart", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (dateEndFilter) items.push({ key: "dateEnd", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minItemCountFilter) items.push({ key: "minItem", label: "Min Items", value: minItemCountFilter, onClear: () => setMinItemCountFilter("") });
    if (maxItemCountFilter) items.push({ key: "maxItem", label: "Max Items", value: maxItemCountFilter, onClear: () => setMaxItemCountFilter("") });
    if (minTotalQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minTotalQtyFilter, onClear: () => setMinTotalQtyFilter("") });
    if (maxTotalQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxTotalQtyFilter, onClear: () => setMaxTotalQtyFilter("") });
    return items;
  }, [supplierFilter, productFilter, dateStartFilter, dateEndFilter, minItemCountFilter, maxItemCountFilter, minTotalQtyFilter, maxTotalQtyFilter]);

  const openForm = () => {
    const firstSupplierId = suppliers[0]?.id_supplier || "";
    setSelectedSupplierId(firstSupplierId);
    setNotes("");
    setItems([{ id_product: "", quantity: "", expired_date: "", purchase_price: "" }]);
    setFormOpen(true);
  };

  const submitStockIn = async () => {
    if (!selectedSupplierId) {
      Alert.alert("Validation", "Please select a supplier first.");
      return;
    }

    if (hasInvalidRows) {
      Alert.alert("Validation", "Each row must have a product, qty > 0, purchase price > 0, and an expired date after today.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_user: userId || null,
          id_supplier: selectedSupplierId,
          notes: notes.trim() || null,
          items: items.map((item) => ({
            id_product: item.id_product,
            quantity: Number(item.quantity),
            expired_date: item.expired_date,
            purchase_price: Number(item.purchase_price),
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to create stock in.");
      }

      setFormOpen(false);
      loadRows();
      Alert.alert("Success", "Stock in saved successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create stock in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Stock In</Text>
          <Text style={styles.subtitle}>Integrated with real stock movement data.</Text>
        </View>
        {canInsert ? (
          <PrimaryActionButton label="Add Stock In" onPress={openForm} />
        ) : null}
      </View>
      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search stock in code, supplier, or notes"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          <IconFilterButton
            onPress={() => {
              setDraftSupplierFilter(supplierFilter);
              setDraftProductFilter(productFilter);
              setDraftDateStartFilter(dateStartFilter);
              setDraftDateEndFilter(dateEndFilter);
              setDraftMinItemCountFilter(minItemCountFilter);
              setDraftMaxItemCountFilter(maxItemCountFilter);
              setDraftMinTotalQtyFilter(minTotalQtyFilter);
              setDraftMaxTotalQtyFilter(maxTotalQtyFilter);
              setFilterOpen(true);
            }}
          />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setSupplierFilter("ALL");
            setProductFilter("ALL");
            setDateStartFilter("");
            setDateEndFilter("");
            setMinItemCountFilter("");
            setMaxItemCountFilter("");
            setMinTotalQtyFilter("");
            setMaxTotalQtyFilter("");
            setDraftSupplierFilter("ALL");
            setDraftProductFilter("ALL");
            setDraftDateStartFilter("");
            setDraftDateEndFilter("");
            setDraftMinItemCountFilter("");
            setDraftMaxItemCountFilter("");
            setDraftMinTotalQtyFilter("");
            setDraftMaxTotalQtyFilter("");
          }}
        />
      </View>
      <View style={styles.tableCard}>
        <View style={styles.tableInner}>
          {!isCompact ? (
            <View style={styles.tableHeader}>
              <Text style={[styles.headCell, styles.colCode]}>Stock In Code</Text>
              <Text style={[styles.headCell, styles.colSupplier]}>Supplier</Text>
              <Text style={[styles.headCell, styles.colReceiver]}>Receiver</Text>
              <Text style={[styles.headCell, styles.colQty]}>Total Qty</Text>
              <Text style={[styles.headCell, styles.colDate]}>Date</Text>
              <Text style={[styles.headCell, styles.colAction]}>Action</Text>
            </View>
          ) : null}

          {(Array.isArray(filteredRows) ? filteredRows : []).map((row) =>
            isCompact ? (
              <Pressable key={row.id_stock_in} style={styles.compactCard} onPress={() => openDetail(row.id_stock_in)}>
                <View style={styles.compactTopRow}>
                  <Text style={styles.compactCode} numberOfLines={1}>{row.stock_in_code}</Text>
                  <Text style={styles.compactQty}>Qty: {row.total_qty}</Text>
                </View>
                <Text style={styles.compactMeta} numberOfLines={1}>Supplier: {row.supplier_name}</Text>
                <Text style={styles.compactMeta} numberOfLines={1}>Receiver: {row.received_by_name || "-"}</Text>
                <Text style={styles.compactMeta}>Date: {new Date(row.stock_in_date).toLocaleString("id-ID")}</Text>
                <Pressable style={styles.compactDetailBtn} onPress={() => openDetail(row.id_stock_in)}>
                  <Text style={styles.compactDetailBtnText}>See Details</Text>
                </Pressable>
              </Pressable>
            ) : (
              <Pressable key={row.id_stock_in} style={[styles.tableRow, openActionStockInId === row.id_stock_in && styles.tableRowActiveLayer]}>
                <Text style={[styles.rowCell, styles.colCode]} numberOfLines={1}>{row.stock_in_code}</Text>
                <Text style={[styles.rowCell, styles.colSupplier]} numberOfLines={1}>{row.supplier_name}</Text>
                <Text style={[styles.rowCell, styles.colReceiver]} numberOfLines={1}>{row.received_by_name || "-"}</Text>
                <Text style={[styles.rowCell, styles.colQty]}>{row.total_qty}</Text>
                <Text style={[styles.rowCell, styles.colDate]}>{new Date(row.stock_in_date).toLocaleString("id-ID")}</Text>
                <View style={[styles.colAction, styles.actionWrap]}>
                  <View style={styles.actionDropdownWrap}>
                    <Pressable style={styles.actionMenuButton} onPress={() => setOpenActionStockInId((prev) => (prev === row.id_stock_in ? null : row.id_stock_in))}>
                      <Text style={styles.actionMenuButtonText}>Actions</Text>
                    </Pressable>
                    {openActionStockInId === row.id_stock_in ? (
                      <View style={styles.actionMenu}>
                        <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionStockInId(null); openDetail(row.id_stock_in); }}>
                          <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            )
          )}
          {filteredRows.length === 0 ? <Text style={styles.emptyText}>No stock in documents found.</Text> : null}
        </View>
      </View>
      

      <FilterSheetModal
        title="Filter Stock In"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (
            draftDateStartFilter &&
            draftDateEndFilter &&
            toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)
          ) {
            Alert.alert("Validation", "End date must be the same as or after Start date.");
            return;
          }
          setSupplierFilter(draftSupplierFilter);
          setProductFilter(draftProductFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setMinItemCountFilter(draftMinItemCountFilter);
          setMaxItemCountFilter(draftMaxItemCountFilter);
          setMinTotalQtyFilter(draftMinTotalQtyFilter);
          setMaxTotalQtyFilter(draftMaxTotalQtyFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftSupplierFilter("ALL");
          setSupplierFilter("ALL");
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
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Supplier"
          value={draftSupplierFilter}
          options={supplierOptions.map((item) => ({ label: item, value: item }))}
          onChange={(value) => {
            setDraftSupplierFilter(value);
            setDraftProductFilter("ALL");
          }}
        />
        <FilterSelectField
          label="Product"
          value={draftProductFilter}
          options={productOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftProductFilter}
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
      </FilterSheetModal>

      <StockInFormModal
        visible={formOpen}
        suppliers={suppliers.map((item) => ({ id_supplier: item.id_supplier, supplier_name: item.supplier_name }))}
        products={products}
        selectedSupplierId={selectedSupplierId}
        notes={notes}
        items={items}
        minimumExpiredDate={tomorrowDate}
        saving={saving}
        onClose={() => (saving ? null : setFormOpen(false))}
        onSupplierChange={(value) => {
          setSelectedSupplierId(value);
          setItems([{ id_product: "", quantity: "", expired_date: "", purchase_price: "" }]);
        }}
        onNotesChange={setNotes}
        onItemChange={(index, patch) => {
          setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
        }}
        onAddRow={() => setItems((prev) => [...prev, { id_product: "", quantity: "", expired_date: "", purchase_price: "" }])}
        onRemoveRow={(index) => setItems((prev) => prev.filter((_, i) => i !== index))}
        onSubmit={submitStockIn}
      />

      <Modal visible={Boolean(selectedDoc)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Stock In Detail</Text>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Stock In Code</Text><Text style={styles.metaValue}>{selectedDoc?.stock_in_code || "-"}</Text></View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Stock In Date</Text>
                <Text style={styles.metaValue}>{selectedDoc ? new Date(selectedDoc.stock_in_date).toLocaleString("id-ID") : "-"}</Text>
              </View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Supplier</Text><Text style={styles.metaValue}>{selectedDoc?.supplier_name || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Receiver</Text><Text style={styles.metaValue}>{selectedDoc?.received_by_name || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Item Count</Text><Text style={styles.metaValue}>{selectedDoc?.items?.length || 0}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>QTY</Text><Text style={styles.metaValue}>{(selectedDoc?.items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0)}</Text></View>
            </View>
            <View style={[styles.metaItem, styles.metaItemFull]}>
              <Text style={styles.metaLabel}>Notes</Text>
              <Text style={styles.metaValue}>{selectedDoc?.notes || "-"}</Text>
            </View>

            <View style={styles.detailTableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.detailInner}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={[styles.detailHead, styles.detailColProduct]}>Product</Text>
                    <Text style={[styles.detailHead, styles.detailColBatch]}>Batch</Text>
                    <Text style={[styles.detailHead, styles.detailColPrice]}>Buy Price</Text>
                    <Text style={[styles.detailHead, styles.detailColQty]}>Qty</Text>
                    <Text style={[styles.detailHead, styles.detailColExp]}>Exp</Text>
                  </View>
                  {(selectedDoc?.items || []).map((item) => (
                    <View key={item.id_stock_in_item} style={styles.detailBodyRow}>
                      <Text style={[styles.detailCell, styles.detailColProduct]} numberOfLines={1}>{item.product_name}</Text>
                      <Text style={[styles.detailCell, styles.detailColBatch]} numberOfLines={1}>{item.batch_code || "-"}</Text>
                      <Text style={[styles.detailCell, styles.detailColPrice]}>
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(item.purchase_price || 0)).replace(/\s/g, " ")}
                      </Text>
                      <Text style={[styles.detailCell, styles.detailColQty]}>{item.quantity}</Text>
                      <Text style={[styles.detailCell, styles.detailColExp]}>{item.expired_date}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedDoc(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  tableCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "visible" },
  tableInner: { width: "100%" },
  compactCard: { borderBottomWidth: 1, borderBottomColor: "#eef2f7", padding: 12, gap: 4 },
  compactTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactCode: { color: "#0f172a", fontSize: 13, fontWeight: "800", flex: 1 },
  compactQty: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  compactMeta: { color: "#334155", fontSize: 12 },
  compactDetailBtn: { marginTop: 6, minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: "#93c5fd", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  compactDetailBtnText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  tableHeader: { minHeight: 42, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7", position: "relative", zIndex: 1 },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "24%" }, colSupplier: { width: "20%" }, colReceiver: { width: "20%" }, colQty: { width: "10%" }, colDate: { width: "18%" }, colAction: { width: "8%", textAlign: "center" },
  emptyText: { color: "#64748b", fontSize: 12, padding: 12 },
  actionWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionDropdownWrap: { position: "relative" },
  actionMenuButton: { minHeight: 28, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionMenuButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  actionMenu: { position: "absolute", top: 30, left: 0, minWidth: 132, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#dbe3ee", padding: 6, gap: 6, zIndex: 50, elevation: 6 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 10, color: "#0f172a" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 980, backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  metaItem: { width: "49%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  metaItemFull: { width: "100%" },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  detailTableCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", overflow: "hidden" },
  detailInner: { width: "100%", minWidth: 960 },
  detailHeaderRow: { minHeight: 38, backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", flexDirection: "row", alignItems: "center" },
  detailBodyRow: { minHeight: 36, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", flexDirection: "row", alignItems: "center" },
  detailHead: { color: "#334155", fontSize: 11, fontWeight: "800", paddingHorizontal: 10 },
  detailCell: { color: "#0f172a", fontSize: 12, paddingHorizontal: 10 },
  detailColProduct: { width: "28%" }, detailColBatch: { width: "24%" }, detailColPrice: { width: "22%" }, detailColQty: { width: "8%" }, detailColExp: { width: "18%" },
  closeBtn: { marginTop: 6, minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

