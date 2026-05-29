import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import StockInFormModal from "../../../components/inventory/StockInFormModal";
import DatePickerField from "../../../components/inventory/DatePickerField";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const tomorrowDate = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);
  const todayDayNumber = useMemo(() => Number(new Date().toISOString().slice(0, 10).replaceAll("-", "")), []);

  const canInsert = canInsertStockMovement(roleName);
  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("id-ID");
  }, []);

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

  const tableColumns = useMemo<InventoryDataTableColumn<StockInDocument>[]>(() => [
    {
      key: "stock_in_code",
      title: "Stock In Code",
      weight: 22,
      sortable: true,
      sortValue: (row) => row.stock_in_code || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.stock_in_code}</Text>,
    },
    {
      key: "supplier_name",
      title: "Supplier",
      weight: 20,
      sortable: true,
      sortValue: (row) => row.supplier_name || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.supplier_name}</Text>,
    },
    {
      key: "received_by_name",
      title: "Receiver",
      weight: 20,
      sortable: true,
      sortValue: (row) => row.received_by_name || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.received_by_name || "-"}</Text>,
    },
    {
      key: "total_qty",
      title: "Total Qty",
      weight: 8,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.total_qty || 0),
      render: (row) => <Text style={styles.rowCell}>{row.total_qty}</Text>,
    },
    {
      key: "stock_in_date",
      title: "Date",
      weight: 16,
      sortable: true,
      sortValue: (row) => new Date(row.stock_in_date).getTime(),
      render: (row) => <Text style={styles.rowCell}>{new Date(row.stock_in_date).toLocaleString("id-ID")}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (row, meta) => (
        <View style={[styles.actionWrap, openActionStockInId === row.id_stock_in ? styles.actionWrapOpen : null]}>
          <InventoryRowActionsMenu
            open={openActionStockInId === row.id_stock_in}
            onToggle={() => setOpenActionStockInId((prev) => (prev === row.id_stock_in ? null : row.id_stock_in))}
            direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
          >
            <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionStockInId(null); openDetail(row.id_stock_in); }}>
              <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
            </Pressable>
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [openActionStockInId]);

  const detailColumns = useMemo<InventoryDataTableColumn<StockInDocumentItem>[]>(() => [
    {
      key: "product_name",
      title: "Product",
      weight: 28,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (row) => <Text style={styles.detailCell} numberOfLines={1}>{row.product_name}</Text>,
    },
    {
      key: "batch_code",
      title: "Batch",
      weight: 24,
      sortable: true,
      sortValue: (row) => row.batch_code || "",
      render: (row) => <Text style={styles.detailCell} numberOfLines={1}>{row.batch_code || "-"}</Text>,
    },
    {
      key: "purchase_price",
      title: "Buy Price",
      weight: 22,
      sortable: true,
      sortValue: (row) => Number(row.purchase_price || 0),
      render: (row) => (
        <Text style={styles.detailCell}>
          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
            .format(Number(row.purchase_price || 0))
            .replace(/\s/g, " ")}
        </Text>
      ),
    },
    {
      key: "quantity",
      title: "Qty",
      weight: 8,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.quantity || 0),
      render: (row) => <Text style={styles.detailCell}>{row.quantity}</Text>,
    },
    {
      key: "expired_date",
      title: "Exp",
      weight: 18,
      sortable: true,
      sortValue: (row) => new Date(row.expired_date).getTime(),
      render: (row) => <Text style={styles.detailCell}>{formatDateTime(row.expired_date)}</Text>,
    },
  ], [formatDateTime]);

  const openForm = () => {
    const firstSupplierId = suppliers[0]?.id_supplier || "";
    setSelectedSupplierId(firstSupplierId);
    setNotes("");
    setItems([{ id_product: "", quantity: "", expired_date: "", purchase_price: "" }]);
    setFormOpen(true);
  };

  const submitStockIn = async () => {
    if (!selectedSupplierId) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Please select a supplier first.");
      setResultModalOpen(true);
      return;
    }

    if (hasInvalidRows) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Each row must have a product, qty > 0, purchase price > 0, and an expired date after today.");
      setResultModalOpen(true);
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
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage("Stock in saved successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to create stock in.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Stock In"
        subtitle="Integrated with real stock movement data."
        action={canInsert ? <PrimaryActionButton label="Add Stock In" onPress={openForm} /> : undefined}
      />
      <InventoryFilterSection
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search stock in code, supplier, or notes"
        onOpenFilter={() => {
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
        activeFilters={activeFilters}
        onClearAllFilters={() => {
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
      <InventoryDataTable
        columns={tableColumns}
        rows={Array.isArray(filteredRows) ? filteredRows : []}
        rowKey={(row) => row.id_stock_in}
        isRowActive={(row) => openActionStockInId === row.id_stock_in}
        emptyText="No stock in documents found."
      />
      

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
        onSubmit={() => setConfirmOpen(true)}
      />

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
        <Text style={styles.confirmText}>Create this stock in data?</Text>
        <View style={styles.confirmActionRow}>
          <Pressable style={styles.cancelBtn} onPress={() => setConfirmOpen(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.submitBtn} onPress={async () => { setConfirmOpen(false); await submitStockIn(); }}>
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
        cardStyle={styles.modalCard}
      >
            <Text style={styles.modalTitle}>Stock In Detail</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaLabel}>Stock In Code</Text><Text style={styles.metaValue}>{selectedDoc?.stock_in_code || "-"}</Text></View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Stock In Date</Text>
                <Text style={styles.metaValue}>{formatDateTime(selectedDoc?.stock_in_date)}</Text>
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

            <InventoryDataTable
              columns={detailColumns}
              rows={selectedDoc?.items || []}
              rowKey={(item) => item.id_stock_in_item}
              emptyText="No detail items."
              enablePagination={false}
            />
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedDoc(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
      </ResponsiveModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  rowCell: { fontSize: 12, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  colCode: { width: "22%" }, colSupplier: { width: "20%" }, colReceiver: { width: "20%" }, colQty: { width: "8%" }, colDate: { width: "16%" }, colAction: { width: "14%", textAlign: "center" },
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
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 10, color: "#0f172a" },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
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
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  closeBtn: { marginTop: 6, minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  confirmModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  confirmText: { color: "#334155", fontSize: 13, lineHeight: 20 },
  confirmActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  resultModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10 },
  resultTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  resultMessage: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  resultCloseBtn: { marginTop: 4, width: "100%", height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  resultCloseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

