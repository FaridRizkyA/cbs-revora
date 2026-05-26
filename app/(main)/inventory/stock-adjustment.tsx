import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import { API_BASE_URL } from "../../../utils/api";
import { canInsertStockMovement, getAuthSession, normalizeRole } from "../../../utils/authSession";

type Movement = {
  id_stock_movement: string;
  adjustment_code?: string;
  id_product: string;
  product_code: string;
  product_name: string;
  movement_type: "IN" | "OUT" | "ADJUSTMENT";
  adjustment_type: "INCREASE" | "DECREASE" | "ADJUSTMENT";
  adjustment_reason?: string;
  quantity: number;
  reason: string | null;
  notes: string | null;
  movement_date: string;
  operator_name: string | null;
};

type Product = {
  id_product: string;
  product_code: string;
  product_name: string;
  available_stock: number;
  is_active?: string;
};

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

export default function StockAdjustmentScreen() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Movement | null>(null);
  const [openActionAdjustmentId, setOpenActionAdjustmentId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [draftTypeFilter, setDraftTypeFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [draftProductFilter, setDraftProductFilter] = useState("ALL");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [maxQtyFilter, setMaxQtyFilter] = useState("");
  const [draftMinQtyFilter, setDraftMinQtyFilter] = useState("");
  const [draftMaxQtyFilter, setDraftMaxQtyFilter] = useState("");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [draftDateStartFilter, setDraftDateStartFilter] = useState("");
  const [draftDateEndFilter, setDraftDateEndFilter] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const canInsert = canInsertStockMovement(roleName);

  const loadRows = () => {
    fetch(`${API_BASE_URL}/api/stock-adjustments`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setRows(safeRows as Movement[]);
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

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        label: `${item.product_name} (${item.product_code})`,
        value: item.id_product,
      })),
    [products]
  );
  const productFilterOptions = useMemo(
    () => Array.from(new Set(rows.map((item) => item.product_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minQty = Number(minQtyFilter || "0");
    const maxQty = Number(maxQtyFilter || "0");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;

    return rows.filter((item) => {
      const rowDate = item.movement_date ? new Date(item.movement_date) : null;
      const matchSearch =
        !query ||
        `${item.product_code} ${item.product_name} ${item.notes || ""} ${item.operator_name || ""}`
          .toLowerCase()
          .includes(query);
      const matchType = typeFilter === "ALL" ? true : item.adjustment_type === typeFilter;
      const matchProduct = productFilter === "ALL" ? true : item.product_name === productFilter;
      const matchMinQty = minQtyFilter.trim() ? Number(item.quantity || 0) >= minQty : true;
      const matchMaxQty = maxQtyFilter.trim() ? Number(item.quantity || 0) <= maxQty : true;
      const matchStartDate = startDate && rowDate ? rowDate >= startDate : true;
      const matchEndDate = endDate && rowDate ? rowDate <= endDate : true;
      return matchSearch && matchType && matchProduct && matchMinQty && matchMaxQty && matchStartDate && matchEndDate;
    });
  }, [rows, search, typeFilter, productFilter, minQtyFilter, maxQtyFilter, dateStartFilter, dateEndFilter]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (typeFilter !== "ALL") items.push({ key: "type", label: "Type", value: typeFilter, onClear: () => setTypeFilter("ALL") });
    if (productFilter !== "ALL") items.push({ key: "product", label: "Product", value: productFilter, onClear: () => setProductFilter("ALL") });
    if (minQtyFilter) items.push({ key: "minQty", label: "Min Qty", value: minQtyFilter, onClear: () => setMinQtyFilter("") });
    if (maxQtyFilter) items.push({ key: "maxQty", label: "Max Qty", value: maxQtyFilter, onClear: () => setMaxQtyFilter("") });
    if (dateStartFilter) items.push({ key: "start", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (dateEndFilter) items.push({ key: "end", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    return items;
  }, [typeFilter, productFilter, minQtyFilter, maxQtyFilter, dateStartFilter, dateEndFilter]);

  const submitAdjustment = async () => {
    if (!selectedProductId) {
      Alert.alert("Validation", "Please select a product first.");
      return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert("Validation", "Quantity must be an integer greater than 0.");
      return;
    }
    if (!notes.trim()) {
      Alert.alert("Validation", "Notes are required for stock opname correction.");
      return;
    }
    if (!userId) {
      Alert.alert("Session", "User session was not found. Please sign in again.");
      return;
    }
    const reason = adjustmentType === "INCREASE" ? "STOCK_OPNAME_PLUS" : "STOCK_OPNAME_MINUS";

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_user: userId,
          id_product: selectedProductId,
          adjustment_type: adjustmentType,
          quantity: Number(quantity),
          reason,
          notes: notes.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to create stock adjustment.");
      }

      setFormOpen(false);
      setSelectedProductId("");
      setAdjustmentType("INCREASE");
      setQuantity("");
      setNotes("");
      loadRows();
      Alert.alert("Success", "Stock adjustment saved successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create stock adjustment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Stock Adjustment</Text>
          <Text style={styles.subtitle}>Manual stock correction journal with full audit trail.</Text>
        </View>
        {canInsert ? (
          <PrimaryActionButton label="Add Adjustment" onPress={() => setFormOpen(true)} />
        ) : null}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search product, reason, notes, operator"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          <IconFilterButton
            onPress={() => {
              setDraftTypeFilter(typeFilter);
              setDraftProductFilter(productFilter);
              setDraftMinQtyFilter(minQtyFilter);
              setDraftMaxQtyFilter(maxQtyFilter);
              setDraftDateStartFilter(dateStartFilter);
              setDraftDateEndFilter(dateEndFilter);
              setFilterOpen(true);
            }}
          />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setTypeFilter("ALL");
            setProductFilter("ALL");
            setMinQtyFilter("");
            setMaxQtyFilter("");
            setDateStartFilter("");
            setDateEndFilter("");
            setDraftTypeFilter("ALL");
            setDraftProductFilter("ALL");
            setDraftMinQtyFilter("");
            setDraftMaxQtyFilter("");
            setDraftDateStartFilter("");
            setDraftDateEndFilter("");
          }}
        />
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headCell, styles.colCode]}>Adjustment Code</Text>
          <Text style={[styles.headCell, styles.colProduct]}>Product</Text>
          <Text style={[styles.headCell, styles.colType]}>Type</Text>
          <Text style={[styles.headCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.headCell, styles.colAction]}>Action</Text>
        </View>
        {(Array.isArray(filteredRows) ? filteredRows : []).map((row) => (
          <View key={row.id_stock_movement} style={[styles.tableRow, openActionAdjustmentId === row.id_stock_movement && styles.tableRowActiveLayer]}>
            <Text style={[styles.rowCell, styles.colCode]} numberOfLines={1}>{row.adjustment_code || "-"}</Text>
            <Text style={[styles.rowCell, styles.colProduct]} numberOfLines={1}>{row.product_name}</Text>
            <Text style={[styles.rowCell, styles.colType]}>{row.adjustment_type}</Text>
            <Text style={[styles.rowCell, styles.colQty]}>{row.quantity}</Text>
            <View style={[styles.colAction, styles.actionWrap]}>
              <View style={styles.actionDropdownWrap}>
                <Pressable style={styles.actionMenuButton} onPress={() => setOpenActionAdjustmentId((prev) => (prev === row.id_stock_movement ? null : row.id_stock_movement))}>
                  <Text style={styles.actionMenuButtonText}>Actions</Text>
                </Pressable>
                {openActionAdjustmentId === row.id_stock_movement ? (
                  <View style={styles.actionMenu}>
                    <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionAdjustmentId(null); setSelectedRow(row); }}>
                      <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}
        {filteredRows.length === 0 ? <Text style={styles.emptyText}>No stock adjustment records found.</Text> : null}
      </View>

      <FilterSheetModal
        title="Filter Adjustments"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            Alert.alert("Validation", "End date must be the same as or after Start date.");
            return;
          }
          setTypeFilter(draftTypeFilter);
          setProductFilter(draftProductFilter);
          setMinQtyFilter(draftMinQtyFilter);
          setMaxQtyFilter(draftMaxQtyFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setTypeFilter("ALL");
          setProductFilter("ALL");
          setMinQtyFilter("");
          setMaxQtyFilter("");
          setDateStartFilter("");
          setDateEndFilter("");
          setDraftTypeFilter("ALL");
          setDraftProductFilter("ALL");
          setDraftMinQtyFilter("");
          setDraftMaxQtyFilter("");
          setDraftDateStartFilter("");
          setDraftDateEndFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Type"
          value={draftTypeFilter}
          options={[
            { label: "ALL", value: "ALL" },
            { label: "INCREASE", value: "INCREASE" },
            { label: "DECREASE", value: "DECREASE" },
          ]}
          onChange={setDraftTypeFilter}
        />
        <FilterSelectField
          label="Product"
          value={draftProductFilter}
          options={[
            { label: "ALL", value: "ALL" },
            ...productFilterOptions.map((item) => ({ label: item, value: item })),
          ]}
          onChange={setDraftProductFilter}
        />
        <Text style={styles.filterLabel}>Qty Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinQtyFilter}
            onChangeText={(value) => setDraftMinQtyFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Min qty"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxQtyFilter}
            onChangeText={(value) => setDraftMaxQtyFilter(value.replace(/[^0-9]/g, ""))}
            placeholder="Max qty"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
        <Text style={styles.filterLabel}>Date Range</Text>
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
      </FilterSheetModal>

      <Modal visible={formOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Stock Adjustment</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField
                label="Product"
                value={selectedProductId}
                options={productOptions}
                onChange={setSelectedProductId}
              />
              <FilterSelectField
                label="Adjustment Type"
                value={adjustmentType}
                options={[
                  { label: "INCREASE", value: "INCREASE" },
                  { label: "DECREASE", value: "DECREASE" },
                ]}
                onChange={(value) => {
                  const nextType = value as "INCREASE" | "DECREASE";
                  setAdjustmentType(nextType);
                }}
              />
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Quantity</Text>
                <TextInput
                  value={quantity}
                  onChangeText={(value) => setQuantity(value.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Required (example: stock opname difference on rack A)"
                  placeholderTextColor="#94a3b8"
                  style={styles.fieldInput}
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => (saving ? null : setFormOpen(false))}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={submitAdjustment} disabled={saving}>
                <Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Adjustment"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedRow)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjustment Detail</Text>
            <View style={styles.detailBody}>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Adjustment Code</Text><Text style={styles.detailValue}>{selectedRow?.adjustment_code || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Product</Text><Text style={styles.detailValue}>{selectedRow?.product_name || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Type</Text><Text style={styles.detailValue}>{selectedRow?.adjustment_type || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Qty</Text><Text style={styles.detailValue}>{selectedRow?.quantity || 0}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Reason</Text><Text style={styles.detailValue}>{displayText(
                  String(selectedRow?.adjustment_reason || selectedRow?.reason || "")
                    .replace("ADJUSTMENT_INCREASE:", "")
                    .replace("ADJUSTMENT_DECREASE:", "")
                    .replace("ADJUSTMENT:", "")
                )}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Operator</Text><Text style={styles.detailValue}>{selectedRow?.operator_name || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Date</Text><Text style={styles.detailValue}>{selectedRow ? new Date(selectedRow.movement_date).toLocaleString("id-ID") : "-"}</Text></View>
                <View style={[styles.detailItem, styles.detailItemFull]}><Text style={styles.detailLabel}>Notes</Text><Text style={styles.detailValue}>{selectedRow?.notes || "-"}</Text></View>
              </View>
              <Pressable style={styles.closePrimaryBtn} onPress={() => setSelectedRow(null)}>
                <Text style={styles.closePrimaryBtnText}>Close</Text>
              </Pressable>
            </View>
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
  tableHeader: { minHeight: 42, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7", position: "relative", zIndex: 1 },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "32%" }, colProduct: { width: "30%" }, colType: { width: "12%" }, colQty: { width: "10%" }, colAction: { width: "16%", textAlign: "center" },
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
  emptyText: { color: "#64748b", fontSize: 12, padding: 12 },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, color: "#0f172a" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 640, maxHeight: "88%", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", padding: 14, borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  formBody: { padding: 14, gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  fieldInput: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  modalActions: { borderTopWidth: 1, borderTopColor: "#eef2f7", padding: 12, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  detailBody: { padding: 14, gap: 10 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, marginBottom: 6 },
  detailItem: { width: "49%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  detailItemFull: { width: "100%" },
  detailLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  detailValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  closePrimaryBtn: { marginTop: 6, minHeight: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closePrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
