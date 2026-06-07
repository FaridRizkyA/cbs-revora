import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import {
  buildSupplierDetailReportPrintHtml,
  buildSupplierTableReportPrintHtml,
  downloadSupplierTableReportExcel,
  supplierTableColumns,
} from "../../../components/reports/suppliers/SupplierReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { canManageInventoryMaster, getAuthSession, normalizeRole } from "../../../utils/authSession";
import { logClientActivity } from "../../../utils/activityLog";
import { printReportHtml } from "../../../utils/printUtils";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";

type Supplier = {
  id_supplier: string;
  supplier_code: string;
  supplier_name: string;
  city: string;
  phone_number: string | null;
  is_active: string;
};

type SupplierProduct = {
  id_product: string;
  product_code: string;
  product_name: string;
  barcode: string | null;
  selling_price: number;
  is_active: string;
};

type PendingActionType = "create" | "edit" | "deactivate" | "activate";
const PHONE_ALLOWED_PATTERN = /^[0-9+\-\s]{1,25}$/;

export default function SuppliersScreen() {
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [draftCityFilter, setDraftCityFilter] = useState("ALL");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [inactiveModalOpen, setInactiveModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierProducts, setSelectedSupplierProducts] = useState<SupplierProduct[]>([]);
  const [openActionSupplierId, setOpenActionSupplierId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [formSupplierCode, setFormSupplierCode] = useState("");
  const [formSupplierName, setFormSupplierName] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionType | null>(null);
  const [pendingSupplier, setPendingSupplier] = useState<Supplier | null>(null);
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

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"table" | "detail">("table");

  const canManage = canManageInventoryMaster(roleName);

  const loadSuppliers = () => {
    fetchWithAuth("/api/suppliers")
      .then((response) => response.json())
      .then((payload) => {
        const safeRows = Array.isArray(payload?.data) ? payload.data : [];
        setRows(safeRows);
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
    loadSuppliers();
  }, []);

  const openCreateForm = () => {
    setIsEdit(false);
    setEditingSupplierId("");
    setFormSupplierCode("");
    setFormSupplierName("");
    setFormCity("");
    setFormPhone("");
    setFormOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setIsEdit(true);
    setEditingSupplierId(supplier.id_supplier);
    setFormSupplierCode(supplier.supplier_code);
    setFormSupplierName(supplier.supplier_name);
    setFormCity(supplier.city || "");
    setFormPhone(supplier.phone_number || "");
    setFormOpen(true);
  };

  const submitForm = async () => {
    let actorId = userId;
    if (!actorId) {
      const session = await getAuthSession().catch(() => null);
      actorId = session?.user?.id_user || "";
      if (actorId) {
        setUserId(actorId);
      }
    }
    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }
    if (!formSupplierName.trim()) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Supplier name is required.");
      setResultModalOpen(true);
      return;
    }
    const phone = formPhone.trim();
    if (phone && !PHONE_ALLOWED_PATTERN.test(phone)) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Phone number format is invalid.");
      setResultModalOpen(true);
      return;
    }
    if (phone) {
      const digitsOnly = phone.replace(/\D/g, "");
      const plusCount = (phone.match(/\+/g) || []).length;
      if (digitsOnly.length < 3 || digitsOnly.length > 20 || plusCount > 1 || (plusCount === 1 && !phone.startsWith("+"))) {
        setResultStatus("error");
        setResultTitle("Validation Error");
        setResultMessage("Phone number format is invalid.");
        setResultModalOpen(true);
        return;
      }
    }
    if (phone && phone.includes("  ")) {
      setFormPhone(phone.replace(/\s{2,}/g, " "));
    }
    if (phone && phone.length > 25) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Phone number is too long.");
      setResultModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const endpoint = isEdit
        ? `/api/suppliers/${editingSupplierId}`
        : `/api/suppliers`;
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? {
            id_user: actorId,
            supplier_name: formSupplierName.trim(),
            city: formCity.trim() || null,
            phone_number: formPhone.trim() || null,
          }
        : {
            id_user: actorId,
            supplier_name: formSupplierName.trim(),
            city: formCity.trim() || null,
            phone_number: formPhone.trim() || null,
          };

      const response = await fetchWithAuth(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to save supplier.");
      }

      setFormOpen(false);
      loadSuppliers();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(isEdit ? "Supplier updated successfully." : "Supplier created successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to save supplier.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const updateSupplierStatus = async (supplier: Supplier, nextState: "Y" | "N") => {
    let actorId = userId;
    if (!actorId) {
      const session = await getAuthSession().catch(() => null);
      actorId = session?.user?.id_user || "";
      if (actorId) {
        setUserId(actorId);
      }
    }
    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/suppliers/${supplier.id_supplier}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_user: actorId, is_active: nextState }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to update supplier status.");
      }
      loadSuppliers();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(nextState === "N" ? "Supplier deactivated successfully." : "Supplier activated successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to update supplier status.");
      setResultModalOpen(true);
    }
  };

  const openConfirm = (type: PendingActionType, supplier?: Supplier) => {
    setPendingAction(type);
    setPendingSupplier(supplier || null);
    setConfirmOpen(true);
  };

  const getConfirmMessage = () => {
    if (pendingAction === "create") return "Create this supplier data?";
    if (pendingAction === "edit") return "Save changes to this supplier?";
    if (pendingAction === "deactivate") return "Deactivate this supplier?";
    if (pendingAction === "activate") return "Activate this supplier?";
    return "Are you sure?";
  };

  const executePendingAction = async () => {
    const action = pendingAction;
    const supplier = pendingSupplier;
    setConfirmOpen(false);
    if (!action) return;

    if (action === "create" || action === "edit") {
      await submitForm();
      return;
    }

    if (action === "deactivate" && supplier) {
      await updateSupplierStatus(supplier, "N");
      return;
    }

    if (action === "activate" && supplier) {
      await updateSupplierStatus(supplier, "Y");
    }
  };

  const cityOptions = useMemo(() => {
    const cities = rows.map((item) => item.city).filter(Boolean);
    return ["ALL", ...Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchSearch =
        !query ||
        `${item.supplier_code} ${item.supplier_name} ${item.city} ${item.phone_number || ""}`
          .toLowerCase()
          .includes(query);
      const matchCity = cityFilter === "ALL" ? true : item.city === cityFilter;
      return matchSearch && matchCity;
    });
  }, [rows, search, cityFilter]);

  const sortSuppliersByCodeAsc = (items: Supplier[]) =>
    [...items].sort((a, b) => (a.supplier_code || "").localeCompare(b.supplier_code || "", undefined, { numeric: true, sensitivity: "base" }));

  const activeRows = useMemo(() => sortSuppliersByCodeAsc(filtered.filter((item) => item.is_active === "Y")), [filtered]);
  const inactiveRows = useMemo(() => sortSuppliersByCodeAsc(filtered.filter((item) => item.is_active !== "Y")), [filtered]);
  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (cityFilter !== "ALL") items.push({ key: "city", label: "City", value: cityFilter, onClear: () => setCityFilter("ALL") });
    return items;
  }, [cityFilter]);

  const buildCurrentSupplierReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (cityFilter !== "ALL") items.push({ label: "City Filter", value: cityFilter });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const isTable = emailTarget === "table";
      const generatedAt = new Date();
      const printHtml = isTable
        ? buildSupplierTableReportPrintHtml({
            rows: activeRows,
            generatedAt,
            generatedBy: roleName,
            meta: buildCurrentSupplierReportMeta(),
          })
        : selectedSupplier
          ? buildSupplierDetailReportPrintHtml({
              supplier: selectedSupplier,
              products: selectedSupplierProducts,
              generatedAt,
              generatedBy: roleName,
              meta: [{ label: "Linked Products", value: selectedSupplierProducts.length }],
            })
          : "";
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: isTable ? "Supplier List Report" : `Supplier Detail - ${selectedSupplier?.supplier_name}`,     
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: isTable ? "Supplier Report" : "Supplier Detail",
        subtitle: isTable ? "Inventory supplier master data" : "",
        generated_by: roleName,
        print_html: printHtml,
        meta: isTable ? buildCurrentSupplierReportMeta() : [
          { label: "Code", value: selectedSupplier?.supplier_code },
          { label: "Supplier", value: selectedSupplier?.supplier_name },
          { label: "City", value: selectedSupplier?.city },
          { label: "Phone", value: selectedSupplier?.phone_number },
        ],
        columns: isTable 
          ? supplierTableColumns.map(c => ({ key: c.key, title: c.title, align: c.align }))
          : [
            { key: "product_code", title: "Product Code" },
            { key: "product_name", title: "Product Name" },
            { key: "barcode", title: "Barcode" },
          ],
        rows: isTable 
          ? activeRows.map((row, idx) => {
              const rowData: any = {};
              supplierTableColumns.forEach(c => { rowData[c.key] = c.getValue(row, idx); });
              return rowData;
            })
          : selectedSupplierProducts.map(p => ({
              product_code: p.product_code,
              product_name: p.product_name,
              barcode: p.barcode || "-",
            })),
      };

      const response = await fetchWithAuth("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_suppliers",
        description: "Sent supplier report via email.",
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

  const handlePrintSupplierTable = async () => {
    try {
      const html = buildSupplierTableReportPrintHtml({
        rows: activeRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentSupplierReportMeta(),
      });
      await printReportHtml(html, {
        tableName: "tbl_suppliers",
        description: "Printed supplier report.",
        fileName: buildReportPdfFileName({ reportKey: "suppliers", variant: "table" }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print supplier report."); 
    }
  };

  const handleExportSupplierExcel = async () => {
    try {
      await downloadSupplierTableReportExcel({
        rows: activeRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentSupplierReportMeta(),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_suppliers",
        description: "Exported supplier report as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export supplier report.");
    }
  };

  const handlePrintSupplierDetail = async () => {
    if (!selectedSupplier) return;

    try {
      const html = buildSupplierDetailReportPrintHtml({
        supplier: selectedSupplier,
        products: selectedSupplierProducts,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: [{ label: "Linked Products", value: selectedSupplierProducts.length }],
      });
      await printReportHtml(html, {
        tableName: "tbl_suppliers",
        description: `Printed supplier detail: ${selectedSupplier.supplier_name}`,
        fileName: buildReportPdfFileName({
          reportKey: "suppliers",
          variant: "detail",
          documentNumber: selectedSupplier.supplier_code,
        }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print supplier detail."); 
    }
  };

  const supplierColumns = useMemo<InventoryDataTableColumn<Supplier>[]>(() => [
    {
      key: "supplier_code",
      title: "Code",
      weight: 14,
      sortable: true,
      sortValue: (row) => row.supplier_code || "",
      render: (row) => <Text style={styles.rowCell}>{row.supplier_code}</Text>,
    },
    {
      key: "supplier_name",
      title: "Supplier Name",
      weight: 36,
      sortable: true,
      sortValue: (row) => row.supplier_name || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.supplier_name}</Text>,
    },
    {
      key: "city",
      title: "City",
      weight: 20,
      sortable: true,
      sortValue: (row) => row.city || "",
      render: (row) => <Text style={styles.rowCell}>{row.city}</Text>,
    },
    {
      key: "phone_number",
      title: "Phone",
      weight: 16,
      sortable: true,
      sortValue: (row) => row.phone_number || "",
      render: (row) => <Text style={styles.rowCell}>{row.phone_number || "-"}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (item, meta) => (
        <View style={[styles.actionCellWrap, openActionSupplierId === item.id_supplier ? styles.actionCellWrapOpen : null]}>
          <InventoryRowActionsMenu
            open={openActionSupplierId === item.id_supplier}
            onToggle={() => setOpenActionSupplierId((prev) => (prev === item.id_supplier ? null : item.id_supplier))}
            direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
          >
            <Pressable
              style={[styles.actionOutlineBtn, styles.actionOutlineInfo]}
              onPress={() => {
                setOpenActionSupplierId(null);
                openProducts(item);
              }}
            >
              <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>Details</Text>
            </Pressable>
            {canManage ? (
              <>
                <Pressable
                  style={[styles.actionOutlineBtn, styles.actionOutlineEdit]}
                  onPress={() => {
                    setOpenActionSupplierId(null);
                    openEditForm(item);
                  }}
                >
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionOutlineBtn, styles.actionOutlineDanger]}
                  onPress={() => {
                    setOpenActionSupplierId(null);
                    openConfirm("deactivate", item);
                  }}
                >
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text> 
                </Pressable>
              </>
            ) : null}
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [canManage, openActionSupplierId]);

  const inactiveSupplierColumns = useMemo<InventoryDataTableColumn<Supplier>[]>(() => [
    {
      key: "supplier_code",
      title: "Code",
      weight: 14,
      sortable: true,
      sortValue: (row) => row.supplier_code || "",
      render: (item) => <Text style={styles.rowCell}>{item.supplier_code}</Text>,
    },
    {
      key: "supplier_name",
      title: "Supplier Name",
      weight: 36,
      sortable: true,
      sortValue: (row) => row.supplier_name || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.supplier_name}</Text>,
    },
    {
      key: "city",
      title: "City",
      weight: 20,
      sortable: true,
      sortValue: (row) => row.city || "",
      render: (item) => <Text style={styles.rowCell}>{item.city}</Text>,
    },
    {
      key: "phone_number",
      title: "Phone",
      weight: 16,
      sortable: true,
      sortValue: (row) => row.phone_number || "",
      render: (item) => <Text style={styles.rowCell}>{item.phone_number || "-"}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (item) =>
        canManage ? (
          <Pressable style={styles.activateButton} onPress={() => openConfirm("activate", item)}>
            <Text style={styles.activateButtonText}>Activate</Text>
          </Pressable>
        ) : null,
    },
  ], [canManage]);

  const openProducts = async (supplier: Supplier) => {
    try {
      const response = await fetchWithAuth(`/api/suppliers/${supplier.id_supplier}/products`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch supplier products.");
      }
      setSelectedSupplierProducts(Array.isArray(payload?.data) ? payload.data : []);
      setSelectedSupplier(supplier);
    } catch {
      setSelectedSupplierProducts([]);
      setSelectedSupplier(supplier);
    }
  };

  const supplierProductDetailColumns = useMemo<InventoryDataTableColumn<SupplierProduct>[]>(() => [
    {
      key: "product_code",
      title: "Code",
      weight: 24,
      sortable: true,
      sortValue: (row) => row.product_code || "",
      render: (row) => <Text style={styles.detailCell}>{row.product_code}</Text>,
    },
    {
      key: "product_name",
      title: "Product",
      weight: 48,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (row) => <Text style={styles.detailCell} numberOfLines={1}>{row.product_name}</Text>,
    },
    {
      key: "barcode",
      title: "Barcode",
      weight: 28,
      sortable: true,
      sortValue: (row) => row.barcode || "",
      render: (row) => <Text style={styles.detailCell} numberOfLines={1}>{row.barcode || "-"}</Text>,
    },
  ], []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Suppliers"
        subtitle="Manage supplier master data for inventory sourcing."
        action={
          <View style={styles.headerActionRow}>
            <ExportDropdownMenu
              onExportPdf={handlePrintSupplierTable}
              onExportExcel={handleExportSupplierExcel}
              onSendEmail={() => {
                setEmailTarget("table");
                setEmailModalOpen(true);
              }}       
            />
            {canManage ? (
              <>
              <Pressable style={styles.secondaryButton} onPress={() => setInactiveModalOpen(true)}>
                <Text style={styles.secondaryButtonText}>Show Inactive</Text>
              </Pressable>
              <PrimaryActionButton label="Add Supplier" onPress={openCreateForm} />
              </>
            ) : null}
          </View>
        }
      />

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="#64748b" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search supplier code, name, city, or phone"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
          </View>
          <IconFilterButton onPress={() => { setDraftCityFilter(cityFilter); setFilterModalOpen(true); }} />    
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setDraftCityFilter("ALL");
            setCityFilter("ALL");
          }}
        />
      </View>

      <InventoryDataTable
        columns={supplierColumns}
        rows={activeRows}
        rowKey={(item) => item.id_supplier}
        isRowActive={(item) => openActionSupplierId === item.id_supplier}
        emptyText="No supplier data found."
      />

      <FilterSheetModal
        title="Filter Suppliers"
        visible={filterModalOpen}
        onApply={() => { setCityFilter(draftCityFilter); setFilterModalOpen(false); }}
        onReset={() => { setDraftCityFilter("ALL"); setCityFilter("ALL"); }}
        onClose={() => setFilterModalOpen(false)}
      >
        <FilterSelectField
          label="City"
          value={draftCityFilter}
          options={cityOptions.map((city) => ({ label: city, value: city }))}
          onChange={setDraftCityFilter}
        />
      </FilterSheetModal>

      <ResponsiveModal
        visible={inactiveModalOpen}
        onClose={() => setInactiveModalOpen(false)}
        maxWidthDesktop={900}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.inactiveModalCard}
      >
        <Text style={styles.modalTitle}>Inactive Suppliers</Text>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          {inactiveRows.length === 0 ? (
            <Text style={styles.modalEmpty}>No inactive supplier data.</Text>
          ) : (
            <InventoryDataTable
              columns={inactiveSupplierColumns}
              rows={inactiveRows}
              rowKey={(item) => item.id_supplier}
              emptyText="No inactive supplier data."
            />
          )}
        </ScrollView>
        <Pressable style={styles.closeButton} onPress={() => setInactiveModalOpen(false)}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={Boolean(selectedSupplier)}
        onClose={() => setSelectedSupplier(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.detailModalCard}
      >
        <View style={styles.detailModalHeader}>
          <Text style={styles.modalTitle}>Supplier Detail</Text>
          <ExportDropdownMenu
            variant="detail"
            onExportPdf={handlePrintSupplierDetail}
            onSendEmail={() => {
              setEmailTarget("detail");
              setEmailModalOpen(true);
            }}
          />
        </View>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>Supplier</Text><Text style={styles.metaValue}>{selectedSupplier?.supplier_name || "-"}</Text></View>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>Code</Text><Text style={styles.metaValue}>{selectedSupplier?.supplier_code || "-"}</Text></View>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>City</Text><Text style={styles.metaValue}>{selectedSupplier?.city || "-"}</Text></View>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>Products</Text><Text style={styles.metaValue}>{selectedSupplierProducts.length}</Text></View>
          </View>
          <InventoryDataTable
            columns={supplierProductDetailColumns}
            rows={selectedSupplierProducts}
            rowKey={(item) => item.id_product}
            emptyText="No linked products."
            enablePagination={false}
          />
        </ScrollView>
        <Pressable style={styles.closeButton} onPress={() => setSelectedSupplier(null)}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        maxWidthDesktop={460}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>{isEdit ? "Edit Supplier" : "Add Supplier"}</Text>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          {isEdit ? (
            <View style={styles.formGroup}>
              <Text style={styles.metaLabel}>Supplier Code</Text>
              <TextInput
                value={formSupplierCode}
                editable={false}
                placeholderTextColor="#94a3b8"
                style={[styles.formInput, styles.formInputDisabled]}
              />
            </View>
          ) : null}
          <View style={styles.formGroup}>
            <Text style={styles.metaLabel}>Supplier Name</Text>
            <TextInput
              value={formSupplierName}
              onChangeText={setFormSupplierName}
              placeholder="Supplier Name"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.metaLabel}>City</Text>
            <TextInput value={formCity} onChangeText={setFormCity} placeholder="City" placeholderTextColor="#94a3b8" style={styles.formInput} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.metaLabel}>Phone</Text>
            <TextInput
              value={formPhone}
              onChangeText={(value) => {
                const sanitized = value.replace(/[^0-9+\-\s]/g, "");
                setFormPhone(sanitized);
              }}
              keyboardType="phone-pad"
              placeholder="Phone Number"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
            />
          </View>
        </ScrollView>
        <View style={styles.formActionRow}>
          <Pressable style={styles.formCancelBtn} onPress={() => (saving ? null : setFormOpen(false))}>
            <Text style={styles.formCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={styles.formSaveBtn}
            onPress={() => openConfirm(isEdit ? "edit" : "create")}
            disabled={saving}
          >
            <Text style={styles.formSaveText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
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
        <Text style={styles.confirmText}>{getConfirmMessage()}</Text>
        <View style={styles.confirmActionRow}>
          <Pressable style={styles.formCancelBtn} onPress={() => setConfirmOpen(false)}>
            <Text style={styles.formCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.formSaveBtn} onPress={executePendingAction}>
            <Text style={styles.formSaveText}>Yes, Continue</Text>
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
        <Feather
          name={resultStatus === "success" ? "check-circle" : "x-circle"}
          size={42}
          color={resultStatus === "success" ? "#16a34a" : "#dc2626"}
        />
        <Text style={styles.resultTitle}>{resultTitle}</Text>
        <Text style={styles.resultMessage}>{resultMessage}</Text>
        <Pressable style={styles.resultCloseBtn} onPress={() => setResultModalOpen(false)}>
          <Text style={styles.resultCloseBtnText}>OK</Text>
        </Pressable>
      </ResponsiveModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "Supplier List" : "Supplier Detail"}
        onSend={handleSendEmailReport}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 14 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  secondaryButton: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  filterCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchWrap: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: "#334155", fontSize: 13, paddingVertical: 0 },
  tableCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "visible" },
  tableHeader: { minHeight: 40, flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5fb", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 1, borderBottomColor: "#dbe3ee", paddingHorizontal: 8 },
  tableRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#eef2f7", paddingHorizontal: 8, position: "relative", zIndex: 1 },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { color: "#3c5477", fontWeight: "700", fontSize: 11, textAlign: "left" },
  rowCell: { color: "#1e3557", fontSize: 11, textAlign: "left" },
  colCode: { width: "14%" }, colName: { width: "36%" }, colCity: { width: "20%" }, colPhone: { width: "16%" }, colAction: { width: "14%", textAlign: "center" },
  leftCell: { justifyContent: "center", alignItems: "flex-start", paddingHorizontal: 8 },
  actionCellWrap: { alignItems: "center", justifyContent: "center" },
  actionCellWrapOpen: { position: "relative", zIndex: 4000 },
  actionHeadText: { textAlign: "center" },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 460, backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8 },  
  detailModalCard: { width: "100%", maxWidth: 980, backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  detailPrintButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrintButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  detailScroll: { maxHeight: "84%" },
  detailScrollContent: { gap: 10, paddingBottom: 6 },
  inactiveModalCard: { width: "100%", maxWidth: 900, backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  inactiveTableCard: { borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  activateButton: { alignSelf: "center", height: 28, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  activateButtonText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  modalEmpty: { color: "#64748b", fontSize: 13, padding: 10 },
  closeButton: { marginTop: 8, height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { width: "48%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  detailHead: { color: "#334155", fontSize: 11, fontWeight: "800", paddingHorizontal: 10 },
  detailCell: { color: "#0f172a", fontSize: 12, paddingHorizontal: 10 },
  formGroup: { gap: 6 },
  formInput: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", paddingHorizontal: 12, color: "#0f172a" },
  formInputDisabled: { backgroundColor: "#e2e8f0", color: "#64748b" },
  formActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  formCancelBtn: { height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  formCancelText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  formSaveBtn: { height: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  formSaveText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  confirmModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  confirmText: { color: "#334155", fontSize: 13, lineHeight: 20 },
  confirmActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  resultModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10 },
  resultTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  resultMessage: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  resultCloseBtn: { marginTop: 4, width: "100%", height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  resultCloseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
