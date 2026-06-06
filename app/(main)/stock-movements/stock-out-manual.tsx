import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import { InventoryConfirmModal, InventoryResultModal } from "../../../components/inventory/ActionModals";
import { API_BASE_URL } from "../../../utils/api";
import { canInsertStockMovement, getAuthSession, normalizeRole } from "../../../utils/authSession";

type StockOutManualDocument = {
  id_stock_out_manual: string;
  stock_out_code: string;
  stock_out_type: string;
  stock_out_date: string;
  notes: string | null;
  item_count: number;
  total_qty: number;
  operator_name: string | null;
  product_names?: string[];
};

type StockOutManualItem = {
  id_stock_movement: string;
  product_code: string;
  product_name: string;
  batch_code: string | null;
  quantity: number;
  reason: string | null;
  notes: string | null;
};

type StockOutManualDetail = {
  id_stock_out_manual: string;
  stock_out_code: string;
  stock_out_type: string;
  stock_out_date: string;
  notes: string | null;
  total_qty: number;
  operator_name: string | null;
  items: StockOutManualItem[];
};

type Product = {
  id_product: string;
  product_code: string;
  product_name: string;
  available_stock: number;
  is_active?: string;
};

type DraftItem = {
  id_product: string;
  quantity: string;
};

const REASONS = ["DAMAGED", "EXPIRED", "RETURN_TO_SUPPLIER", "LOST", "OTHER"];

export default function StockOutManualScreen() {
  const [rows, setRows] = useState<StockOutManualDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<StockOutManualDetail | null>(null);
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [draftReasonFilter, setDraftReasonFilter] = useState("ALL");
  const [operatorFilter, setOperatorFilter] = useState("ALL");
  const [draftOperatorFilter, setDraftOperatorFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const [reason, setReason] = useState("DAMAGED");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ id_product: "", quantity: "" }]);

  const canInsert = canInsertStockMovement(roleName);

  const loadRows = () => {
    fetch(`${API_BASE_URL}/api/stock-out-manual-documents`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setRows(safeRows as StockOutManualDocument[]);
      })
      .catch(() => setRows([]));
  };

  const loadProducts = async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const payload = await response.json();
    const safeRows = Array.isArray(payload?.data) ? payload.data : [];
    setProducts(safeRows.filter((item) => item?.is_active !== "N"));
  };

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
        setUserId(session?.user?.id_user || "");
      })
      .catch(() => setRoleName("CASHIER"));
    loadRows();
    loadProducts().catch(() => setProducts([]));
  }, []);

  const operatorOptions = useMemo(() => {
    const names = rows.map((item) => String(item.operator_name || "-")).filter(Boolean);
    return ["ALL", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))];
  }, [rows]);
  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        label: `${item.product_name} (${item.product_code})`,
        value: item.id_product,
      })),
    [products]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => {
      const normalizedReason = String(
        (item as unknown as { reason?: string | null }).reason || ""
      ).replace("NON_SALE_OUT:", "");
      const text = `${item.stock_out_code} ${item.notes || ""} ${item.operator_name || ""} ${normalizedReason}`.toLowerCase();
      const matchSearch = !query || text.includes(query);
      const matchReason = reasonFilter === "ALL" ? true : normalizedReason === reasonFilter;
      const matchOperator = operatorFilter === "ALL" ? true : String(item.operator_name || "-") === operatorFilter;
      return matchSearch && matchReason && matchOperator;
    });
  }, [rows, search, reasonFilter, operatorFilter]);

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (reasonFilter !== "ALL") list.push({ key: "reason", label: "Reason", value: reasonFilter, onClear: () => setReasonFilter("ALL") });
    if (operatorFilter !== "ALL") list.push({ key: "operator", label: "Operator", value: operatorFilter, onClear: () => setOperatorFilter("ALL") });
    return list;
  }, [reasonFilter, operatorFilter]);

  const openDetail = async (idStockOutManual: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-out-manual-documents/${idStockOutManual}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to fetch detail.");
      setSelectedDoc(payload?.data || null);
    } catch (error) {
      showResult("error", "Error", error instanceof Error ? error.message : "Failed to fetch detail.");
    }
  };

  const submit = async () => {
    if (!userId) {
      setResultStatus("error");
      setResultTitle("Session Expired");
      setResultMessage("User session was not found. Please sign in again.");
      setResultModalOpen(true);
      return;
    }
    const hasInvalid = items.some((item) => !item.id_product || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0);
    if (hasInvalid) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Every row must have a product and quantity greater than 0.");
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
          reason,
          notes: notes.trim() || null,
          items: items.map((item) => ({ id_product: item.id_product, quantity: Number(item.quantity) })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to create stock out non-sales.");
      setFormOpen(false);
      setReason("DAMAGED");
      setNotes("");
      setItems([{ id_product: "", quantity: "" }]);
      loadRows();
      await loadProducts();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage("Stock out non-sales saved successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to create stock out non-sales.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Stock Out Non-Sales</Text>
          <Text style={styles.subtitle}>Manual stock out for non-sales purposes (damaged, expired, return, etc).</Text>
        </View>
        {canInsert ? (
          <PrimaryActionButton label="Add Stock Out" onPress={() => setFormOpen(true)} />
        ) : null}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search code, operator, notes" placeholderTextColor="#94a3b8" style={styles.searchInput} />
          <IconFilterButton onPress={() => { setDraftReasonFilter(reasonFilter); setDraftOperatorFilter(operatorFilter); setFilterOpen(true); }} />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setReasonFilter("ALL");
            setOperatorFilter("ALL");
            setDraftReasonFilter("ALL");
            setDraftOperatorFilter("ALL");
          }}
        />
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headCell, styles.colCode]}>Stock Out Code</Text>
          <Text style={[styles.headCell, styles.colQty]}>Total Qty</Text>
          <Text style={[styles.headCell, styles.colOperator]}>Operator</Text>
          <Text style={[styles.headCell, styles.colDate]}>Date</Text>
          <Text style={[styles.headCell, styles.colAction]}>Action</Text>
        </View>
        {(Array.isArray(filteredRows) ? filteredRows : []).map((row) => (
          <View key={row.id_stock_out_manual} style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.colCode]} numberOfLines={1}>{row.stock_out_code}</Text>
            <Text style={[styles.rowCell, styles.colQty]}>{row.total_qty}</Text>
            <Text style={[styles.rowCell, styles.colOperator]} numberOfLines={1}>{row.operator_name || "-"}</Text>
            <Text style={[styles.rowCell, styles.colDate]}>{new Date(row.stock_out_date).toLocaleString("id-ID")}</Text>
            <View style={[styles.colAction, styles.actionWrap]}>
              <Pressable style={styles.detailBtn} onPress={() => openDetail(row.id_stock_out_manual)}>
                <Text style={styles.detailBtnText}>See Details</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <FilterSheetModal
        title="Filter Stock Out Non-Sales"
        visible={filterOpen}
        onApply={() => {
          setReasonFilter(draftReasonFilter);
          setOperatorFilter(draftOperatorFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setReasonFilter("ALL");
          setOperatorFilter("ALL");
          setDraftReasonFilter("ALL");
          setDraftOperatorFilter("ALL");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField label="Reason" value={draftReasonFilter} options={[{ label: "ALL", value: "ALL" }, ...REASONS.map((item) => ({ label: item, value: item }))]} onChange={setDraftReasonFilter} />
        <FilterSelectField label="Operator" value={draftOperatorFilter} options={operatorOptions.map((item) => ({ label: item, value: item }))} onChange={setDraftOperatorFilter} />
      </FilterSheetModal>

      <ResponsiveModal
        visible={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        maxWidthDesktop={640}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.82}
        cardStyle={styles.modalCard}
      >
            <Text style={styles.modalTitle}>Add Stock Out Non-Sales</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField label="Reason" value={reason} options={REASONS.map((item) => ({ label: item, value: item }))} onChange={setReason} />
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput value={notes} onChangeText={setNotes} placeholder="Optional notes" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
              </View>
              {items.map((item, index) => (
                <View key={`${index}-${item.id_product}`} style={styles.itemCard}>
                  <FilterSelectField
                    label={`Product #${index + 1}`}
                    value={item.id_product}
                    options={productOptions
                      .filter((option) => option.value === item.id_product || !items.some((x, i) => i !== index && x.id_product === option.value))}
                    onChange={(value) => {
                      setItems((prev) => prev.map((row, i) => (i === index ? { ...row, id_product: value } : row)));
                    }}
                  />
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(value) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: value.replace(/[^0-9]/g, "") } : row)))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      style={styles.fieldInput}
                    />
                  </View>
                  {items.length > 1 ? (
                    <Pressable style={styles.removeBtn} onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}>
                      <Text style={styles.removeBtnText}>Remove Row</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <PrimaryActionButton
                label="Add Product Row"
                onPress={() => setItems((prev) => [...prev, { id_product: "", quantity: "" }])}
                fullWidth
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => (saving ? null : setFormOpen(false))}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable>
              <Pressable style={styles.submitBtn} onPress={() => setConfirmOpen(true)} disabled={saving}><Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Stock Out"}</Text></Pressable>
            </View>
      </ResponsiveModal>

      <InventoryConfirmModal
        visible={confirmOpen}
        title="Create Stock Out?"
        message="Create this non-sales stock out document and reduce the selected item stock?"
        confirmLabel="Create Stock Out"
        tone="danger"
        loading={saving}
        onCancel={() => (saving ? null : setConfirmOpen(false))}
        onConfirm={async () => {
          setConfirmOpen(false);
          await submit();
        }}
      />

      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />

      <ResponsiveModal
        visible={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.detailModalCard}
      >
            <Text style={styles.modalTitle}>Stock Out Non-Sales Detail</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Code</Text><Text style={styles.metaValue}>{selectedDoc?.stock_out_code || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Operator</Text><Text style={styles.metaValue}>{selectedDoc?.operator_name || "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Date</Text><Text style={styles.metaValue}>{selectedDoc ? new Date(selectedDoc.stock_out_date).toLocaleString("id-ID") : "-"}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Total Qty</Text><Text style={styles.metaValue}>{selectedDoc?.total_qty || 0}</Text></View>
              <View style={[styles.metaItem, styles.metaItemFull]}><Text style={styles.metaLabel}>Notes</Text><Text style={styles.metaValue}>{selectedDoc?.notes || "-"}</Text></View>
            </View>
            <View style={styles.detailTableCard}>
              <View style={styles.detailHeader}>
                <Text style={[styles.detailHeadCell, styles.detailColProduct]}>Product</Text>
                <Text style={[styles.detailHeadCell, styles.detailColBatch]}>Batch</Text>
                <Text style={[styles.detailHeadCell, styles.detailColQty]}>Qty</Text>
                <Text style={[styles.detailHeadCell, styles.detailColReason]}>Reason</Text>
              </View>
              {(selectedDoc?.items || []).map((item) => (
                <View key={item.id_stock_movement} style={styles.detailRow}>
                  <Text style={[styles.detailCell, styles.detailColProduct]} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={[styles.detailCell, styles.detailColBatch]} numberOfLines={1}>{item.batch_code || "-"}</Text>
                  <Text style={[styles.detailCell, styles.detailColQty]}>{item.quantity}</Text>
                  <Text style={[styles.detailCell, styles.detailColReason]} numberOfLines={1}>{String(item.reason || "").replace("NON_SALE_OUT:", "") || "-"}</Text>
                </View>
              ))}
            </View>
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedDoc(null)}><Text style={styles.closeBtnText}>Close</Text></Pressable>
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
  tableCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  tableHeader: { minHeight: 42, backgroundColor: "#f1f5f9", flexDirection: "row", alignItems: "center", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 1, borderBottomColor: "#dbe3ee" },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "34%" }, colQty: { width: "12%" }, colOperator: { width: "20%" }, colDate: { width: "18%" }, colAction: { width: "16%", textAlign: "center" },
  actionWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  detailBtn: { minHeight: 28, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, justifyContent: "center" },
  detailBtnText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  modalCard: { borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  detailModalCard: { borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden", padding: 16, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  formBody: { padding: 16, gap: 10 },
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
  detailTableCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", overflow: "hidden" },
  detailHeader: { minHeight: 38, backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", flexDirection: "row", alignItems: "center" },
  detailHeadCell: { color: "#334155", fontSize: 11, fontWeight: "800", paddingHorizontal: 10 },
  detailRow: { minHeight: 36, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", flexDirection: "row", alignItems: "center" },
  detailCell: { color: "#0f172a", fontSize: 12, paddingHorizontal: 10 },
  detailColProduct: { width: "34%" }, detailColBatch: { width: "26%" }, detailColQty: { width: "10%" }, detailColReason: { width: "30%" },
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closeBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
