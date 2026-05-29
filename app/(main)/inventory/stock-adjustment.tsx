import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import { InventoryConfirmModal, InventoryResultModal } from "../../../components/inventory/ActionModals";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import { API_BASE_URL } from "../../../utils/api";
import { canInsertStockMovement, getAuthSession, normalizeRole } from "../../../utils/authSession";

type Movement = {
  id_stock_movement: string;
  adjustment_code?: string;
  id_product: string;
  id_product_batch?: string | null;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  buy_per_pcs?: number | null;
  total_loss?: number | null;
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

type ProductBatch = {
  id_product_batch: string;
  batch_code: string;
  expired_date?: string | null;
  batch_qty: number;
};

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");
const formatCurrency = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

export default function StockAdjustmentScreen() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
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
  const batchOptions = useMemo(
    () =>
      productBatches
        .filter((item) => (adjustmentType === "DECREASE" ? Number(item.batch_qty || 0) > 0 : true))
        .map((item) => ({
          value: item.id_product_batch,
          label: `${item.batch_code} • Qty ${item.batch_qty}${item.expired_date ? ` • Exp ${new Date(item.expired_date).toLocaleDateString("id-ID")}` : ""}`,
        })),
    [productBatches, adjustmentType]
  );
  const selectedBatchQty = useMemo(
    () => Number(productBatches.find((item) => item.id_product_batch === selectedBatchId)?.batch_qty || 0),
    [productBatches, selectedBatchId]
  );

  useEffect(() => {
    if (!selectedProductId) {
      setProductBatches([]);
      setSelectedBatchId("");
      return;
    }
    fetch(`${API_BASE_URL}/api/products/${selectedProductId}/batches`)
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setProductBatches(safeRows as ProductBatch[]);
      })
      .catch(() => setProductBatches([]));
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedBatchId) return;
    const allowed = batchOptions.some((item) => item.value === selectedBatchId);
    if (!allowed) setSelectedBatchId("");
  }, [batchOptions, selectedBatchId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minQty = Number(minQtyFilter || "0");
    const maxQty = Number(maxQtyFilter || "0");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;

    return rows.filter((item) => {
      const rowDate = item.movement_date ? new Date(item.movement_date) : null;
      const normalizedReason = displayText(
        String(item.adjustment_reason || item.reason || "")
          .replace("ADJUSTMENT_INCREASE:", "")
          .replace("ADJUSTMENT_DECREASE:", "")
          .replace("ADJUSTMENT:", "")
      );
      const matchSearch =
        !query ||
        `${item.adjustment_code || ""} ${item.product_code} ${item.product_name} ${normalizedReason} ${item.notes || ""} ${item.operator_name || ""}`
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

  const tableColumns = useMemo<InventoryDataTableColumn<Movement>[]>(() => [
    {
      key: "adjustment_code",
      title: "Adjustment Code",
      weight: 32,
      sortable: true,
      sortValue: (row) => row.adjustment_code || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.adjustment_code || "-"}</Text>,
    },
    {
      key: "product_name",
      title: "Product",
      weight: 30,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.product_name}</Text>,
    },
    {
      key: "adjustment_type",
      title: "Type",
      weight: 12,
      sortable: true,
      sortValue: (row) => row.adjustment_type || "",
      render: (row) => <Text style={styles.rowCell}>{row.adjustment_type}</Text>,
    },
    {
      key: "quantity",
      title: "Qty",
      weight: 10,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.quantity || 0),
      render: (row) => <Text style={styles.rowCell}>{row.quantity}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 16,
      align: "center",
      render: (row, meta) => (
        <View style={[styles.actionWrap, openActionAdjustmentId === row.id_stock_movement ? styles.actionWrapOpen : null]}>
          <InventoryRowActionsMenu
            open={openActionAdjustmentId === row.id_stock_movement}
            onToggle={() => setOpenActionAdjustmentId((prev) => (prev === row.id_stock_movement ? null : row.id_stock_movement))}
            direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
          >
            <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionAdjustmentId(null); setSelectedRow(row); }}>
              <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
            </Pressable>
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [openActionAdjustmentId]);

  const submitAdjustment = async () => {
    if (!selectedProductId) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Please select a product first.");
      setResultModalOpen(true);
      return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Quantity must be an integer greater than 0.");
      setResultModalOpen(true);
      return;
    }
    if (!selectedBatchId) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Please select a batch first.");
      setResultModalOpen(true);
      return;
    }
    if (adjustmentType === "DECREASE" && Number(quantity) > selectedBatchQty) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage(`Quantity exceeds selected batch stock (${selectedBatchQty}).`);
      setResultModalOpen(true);
      return;
    }
    if (!notes.trim()) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Notes are required for stock count correction.");
      setResultModalOpen(true);
      return;
    }
    if (!userId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("User session was not found. Please sign in again.");
      setResultModalOpen(true);
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
          id_product_batch: selectedBatchId,
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
      setSelectedBatchId("");
      setProductBatches([]);
      setAdjustmentType("INCREASE");
      setQuantity("");
      setNotes("");
      loadRows();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage("Stock adjustment saved successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to create stock adjustment.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Stock Adjustment"
        subtitle="Manual stock correction journal with full audit trail."
        action={canInsert ? <PrimaryActionButton label="Add Adjustment" onPress={() => setFormOpen(true)} /> : undefined}
      />

      <InventoryFilterSection
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search product, reason, notes, operator"
        onOpenFilter={() => {
          setDraftTypeFilter(typeFilter);
          setDraftProductFilter(productFilter);
          setDraftMinQtyFilter(minQtyFilter);
          setDraftMaxQtyFilter(maxQtyFilter);
          setDraftDateStartFilter(dateStartFilter);
          setDraftDateEndFilter(dateEndFilter);
          setFilterOpen(true);
        }}
        activeFilters={activeFilters}
        onClearAllFilters={() => {
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

      <InventoryDataTable
        columns={tableColumns}
        rows={Array.isArray(filteredRows) ? filteredRows : []}
        rowKey={(row) => row.id_stock_movement}
        isRowActive={(row) => openActionAdjustmentId === row.id_stock_movement}
        emptyText="No stock adjustment records found."
      />

      <FilterSheetModal
        title="Filter Adjustments"
        visible={filterOpen}
        onApply={() => {
          const toDayNumber = (value: string) => Number(value.replaceAll("-", ""));
          if (draftDateStartFilter && draftDateEndFilter && toDayNumber(draftDateEndFilter) < toDayNumber(draftDateStartFilter)) {
            Alert.alert("Validation", "End date must be the same as or after Start date.");
            return;
          }
          if (draftMinQtyFilter.trim() && draftMaxQtyFilter.trim() && Number(draftMaxQtyFilter) < Number(draftMinQtyFilter)) {
            Alert.alert("Validation", "Max qty must be greater than or equal to Min qty.");
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

      <ResponsiveModal
        visible={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        maxWidthDesktop={640}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.82}
        cardStyle={styles.modalCard}
      >
            <Text style={styles.modalTitle}>Add Stock Adjustment</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField
                label="Product"
                value={selectedProductId}
                options={productOptions}
                onChange={(value) => {
                  setSelectedProductId(value);
                  setSelectedBatchId("");
                }}
              />
              <FilterSelectField
                label="Batch"
                value={selectedBatchId}
                options={batchOptions}
                onChange={setSelectedBatchId}
              />
              {adjustmentType === "DECREASE" && selectedBatchId ? (
                <Text style={styles.batchHint}>Available in selected batch: {selectedBatchQty}</Text>
              ) : null}
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
                  placeholder="Required (example: stock count difference on rack A)"
                  placeholderTextColor="#94a3b8"
                  style={styles.fieldInput}
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => (saving ? null : setFormOpen(false))}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={() => setConfirmOpen(true)} disabled={saving}>
                <Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Adjustment"}</Text>
              </Pressable>
            </View>
      </ResponsiveModal>

      <InventoryConfirmModal
        visible={confirmOpen}
        message="Create this stock adjustment data?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => { setConfirmOpen(false); await submitAdjustment(); }}
      />

      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />

      <ResponsiveModal
        visible={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        maxWidthDesktop={640}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
            <Text style={styles.modalTitle}>Adjustment Detail</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailBody}>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Adjustment Code</Text><Text style={styles.detailValue}>{selectedRow?.adjustment_code || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Product</Text><Text style={styles.detailValue}>{selectedRow?.product_name || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Batch</Text><Text style={styles.detailValue}>{selectedRow?.batch_code || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Type</Text><Text style={styles.detailValue}>{selectedRow?.adjustment_type || "-"}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Qty</Text><Text style={styles.detailValue}>{selectedRow?.quantity || 0}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Buy/Pcs</Text><Text style={styles.detailValue}>{formatCurrency(Number(selectedRow?.buy_per_pcs || 0))}</Text></View>
                <View style={styles.detailItem}><Text style={styles.detailLabel}>Total Loss</Text><Text style={styles.detailValue}>{formatCurrency(Number(selectedRow?.total_loss || 0))}</Text></View>
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
            </ScrollView>
      </ResponsiveModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "32%" }, colProduct: { width: "30%" }, colType: { width: "12%" }, colQty: { width: "10%" }, colAction: { width: "16%", textAlign: "center" },
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
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  dateFieldWrap: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, color: "#0f172a" },
  modalCard: { borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", padding: 14, borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  formBody: { padding: 14, gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  fieldInput: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  batchHint: { marginTop: -4, color: "#64748b", fontSize: 11, fontWeight: "600" },
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
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closePrimaryBtn: { marginTop: 6, minHeight: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closePrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
