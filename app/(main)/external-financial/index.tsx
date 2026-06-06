import * as Print from "expo-print";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import DatePickerField from "../../../components/inventory/DatePickerField";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import { InventoryConfirmModal, InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildExternalFinancialDetailReportPrintHtml,
  buildExternalFinancialTableReportPrintHtml,
  downloadExternalFinancialTableReportExcel,
} from "../../../components/reports/external-financial/ExternalFinancialReportPrintTemplate";
import { formatDate, formatRupiah } from "../../../components/shu/formatters";
import { API_BASE_URL } from "../../../utils/api";
import { logClientActivity } from "../../../utils/activityLog";
import { canManageExternalFinancial, getAuthSession, normalizeRole } from "../../../utils/authSession";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";

type ExternalFinancialEntry = {
  id_external_entry: string;
  entry_type: "INCOME" | "OUTCOME";
  entry_date: string;
  entry_source: string;
  amount: number;
  notes?: string | null;
  is_active: "Y" | "N";
};

type FormState = {
  entry_type: "INCOME" | "OUTCOME";
  entry_date: string;
  entry_source: string;
  amount: string;
  notes: string;
};

type PendingAction =
  | { type: "save" }
  | { type: "status"; row: ExternalFinancialEntry };

const emptyForm: FormState = {
  entry_type: "INCOME",
  entry_date: new Date().toISOString().slice(0, 10),
  entry_source: "",
  amount: "",
  notes: "",
};

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

const printReportHtml = async (html: string) => {
  await logClientActivity({
    activityType: "PRINT_REPORT",
    tableName: "tbl_external_financial_entries",
    description: "Printed external financial report.",
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

export default function ExternalFinancialScreen() {
  const [rows, setRows] = useState<ExternalFinancialEntry[]>([]);
  const [roleName, setRoleName] = useState("CASHIER");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [minAmountFilter, setMinAmountFilter] = useState("");
  const [maxAmountFilter, setMaxAmountFilter] = useState("");
  const [draftTypeFilter, setDraftTypeFilter] = useState("ALL");
  const [draftDateStartFilter, setDraftDateStartFilter] = useState("");
  const [draftDateEndFilter, setDraftDateEndFilter] = useState("");
  const [draftMinAmountFilter, setDraftMinAmountFilter] = useState("");
  const [draftMaxAmountFilter, setDraftMaxAmountFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<ExternalFinancialEntry | null>(null);
  const [selectedRow, setSelectedRow] = useState<ExternalFinancialEntry | null>(null);
  const [openActionEntryId, setOpenActionEntryId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
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

  const canManage = canManageExternalFinancial(roleName);

  const loadRows = useCallback(() => {
    fetch(`${API_BASE_URL}/api/external-financial-entries`)
      .then((response) => response.json())
      .then((payload) => setRows(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    getAuthSession()
      .then((session) => setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER"))
      .catch(() => setRoleName("CASHIER"));
    loadRows();
  }, [loadRows]);

  const openCreate = () => {
    setEditingRow(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = useCallback((row: ExternalFinancialEntry) => {
    setEditingRow(row);
    setForm({
      entry_type: row.entry_type,
      entry_date: String(row.entry_date || "").slice(0, 10),
      entry_source: row.entry_source || "",
      amount: String(Number(row.amount || 0)),
      notes: row.notes || "",
    });
    setFormOpen(true);
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minAmount = Number(minAmountFilter || "0");
    const maxAmount = Number(maxAmountFilter || "0");
    const startDate = dateStartFilter ? new Date(`${dateStartFilter}T00:00:00`) : null;
    const endDate = dateEndFilter ? new Date(`${dateEndFilter}T23:59:59`) : null;
    return rows.filter((row) => {
      const rowDate = row.entry_date ? new Date(row.entry_date) : null;
      const matchSearch =
        !query ||
        `${row.entry_type} ${row.entry_source} ${row.notes || ""} ${row.entry_date}`.toLowerCase().includes(query);
      const matchType = typeFilter === "ALL" ? true : row.entry_type === typeFilter;
      const matchStartDate = startDate && rowDate ? rowDate >= startDate : true;
      const matchEndDate = endDate && rowDate ? rowDate <= endDate : true;
      const matchMinAmount = minAmountFilter ? Number(row.amount || 0) >= minAmount : true;
      const matchMaxAmount = maxAmountFilter ? Number(row.amount || 0) <= maxAmount : true;
      return matchSearch && matchType && matchStartDate && matchEndDate && matchMinAmount && matchMaxAmount;    
    });
  }, [rows, search, typeFilter, dateStartFilter, dateEndFilter, minAmountFilter, maxAmountFilter]);

  const activeRows = useMemo(() => filteredRows.filter((row) => row.is_active === "Y"), [filteredRows]);        
  const inactiveRows = useMemo(() => filteredRows.filter((row) => row.is_active !== "Y"), [filteredRows]);      

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (typeFilter !== "ALL") items.push({ key: "type", label: "Type", value: typeFilter, onClear: () => setTypeFilter("ALL") });
    if (dateStartFilter) items.push({ key: "dateStart", label: "Start Date", value: dateStartFilter, onClear: () => setDateStartFilter("") });
    if (dateEndFilter) items.push({ key: "dateEnd", label: "End Date", value: dateEndFilter, onClear: () => setDateEndFilter("") });
    if (minAmountFilter) items.push({ key: "minAmount", label: "Min Amount", value: minAmountFilter, onClear: () => setMinAmountFilter("") });
    if (maxAmountFilter) items.push({ key: "maxAmount", label: "Max Amount", value: maxAmountFilter, onClear: () => setMaxAmountFilter("") });
    return items;
  }, [typeFilter, dateStartFilter, dateEndFilter, minAmountFilter, maxAmountFilter]);

  const submitForm = async () => {
    const amount = Number(form.amount || 0);
    if (!form.entry_source.trim()) {
      showResult("error", "Validation", "Source is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showResult("error", "Validation", "Amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const session = await getAuthSession();
      const endpoint = editingRow
        ? `${API_BASE_URL}/api/external-financial-entries/${editingRow.id_external_entry}`
        : `${API_BASE_URL}/api/external-financial-entries`;
      const response = await fetch(endpoint, {
        method: editingRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount,
          id_user: session?.user?.id_user || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to save external financial entry.");
      setFormOpen(false);
      loadRows();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(editingRow ? "External financial entry updated successfully." : "External financial entry created successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to save external financial entry.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = useCallback(async (row: ExternalFinancialEntry) => {
    try {
      const session = await getAuthSession();
      const response = await fetch(`${API_BASE_URL}/api/external-financial-entries/${row.id_external_entry}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: row.is_active === "Y" ? "N" : "Y",
          id_user: session?.user?.id_user || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update entry status.");
      loadRows();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(row.is_active === "Y" ? "External financial entry deactivated successfully." : "External financial entry activated successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to update entry status.");
      setResultModalOpen(true);
    }
  }, [loadRows]);

  const getPendingActionMessage = () => {
    if (pendingAction?.type === "save") {
      return editingRow ? "Save changes to this external financial entry?" : "Create this external financial entry?";
    }
    if (pendingAction?.type === "status") {
      return pendingAction.row.is_active === "Y"
        ? "Deactivate this external financial entry? It will be hidden from active lists."
        : "Activate this external financial entry?";
    }
    return "Continue this action?";
  };

  const executePendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    if (action.type === "save") {
      await submitForm();
      return;
    }
    await toggleActive(action.row);
  };

  const buildCurrentExternalFinancialReportMeta = () => {
    const items: { label: string; value: string }[] = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (typeFilter !== "ALL") items.push({ label: "Type Filter", value: typeFilter });
    if (dateStartFilter) items.push({ label: "Start Date", value: dateStartFilter });
    if (dateEndFilter) items.push({ label: "End Date", value: dateEndFilter });
    if (minAmountFilter.trim()) items.push({ label: "Min Amount", value: minAmountFilter });
    if (maxAmountFilter.trim()) items.push({ label: "Max Amount", value: maxAmountFilter });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string) => {
    try {
      const isTable = emailTarget === "table";
      const generatedAt = new Date();
      const printHtml = isTable
        ? buildExternalFinancialTableReportPrintHtml({
            rows: activeRows,
            generatedAt,
            generatedBy: roleName,
            meta: buildCurrentExternalFinancialReportMeta(),
          })
        : selectedRow
          ? buildExternalFinancialDetailReportPrintHtml({
              entry: selectedRow,
              generatedAt,
              generatedBy: roleName,
            })
          : "";
      const payload = {
        recipient_email: recipientEmail,
        subject: isTable ? "External Financial List Report" : `External Financial Detail - ${selectedRow?.entry_source}`,
        message,
        format: "PDF",
        title: isTable ? "External Financial List" : "External Financial Detail",
        generated_by: roleName,
        print_html: printHtml,
        meta: isTable ? buildCurrentExternalFinancialReportMeta() : [
          { label: "Date", value: formatDate(selectedRow?.entry_date || "") },
          { label: "Type", value: selectedRow?.entry_type },
          { label: "Source", value: displayText(selectedRow?.entry_source) },
          { label: "Amount", value: formatRupiah(selectedRow?.amount || 0) },
        ],
        columns: isTable ? [
          { key: "entry_date", title: "Date" },
          { key: "entry_type", title: "Type" },
          { key: "entry_source", title: "Source" },
          { key: "amount", title: "Amount" },
        ] : [
          { key: "entry_date", title: "Date" },
          { key: "entry_type", title: "Type" },
          { key: "entry_source", title: "Source" },
          { key: "amount", title: "Amount" },
          { key: "notes", title: "Notes" },
        ],
        rows: isTable ? activeRows : [selectedRow],
      };

      const response = await fetch(`${API_BASE_URL}/api/reports/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_external_financial_entries",
        description: "Sent external financial report via email.",
      });

      setResultStatus("success");
      setResultTitle("Email Sent");
      setResultMessage("Report has been sent successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Send Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to send email.");
      setResultModalOpen(true);
    }
  };

  const handlePrintExternalFinancialTable = async () => {
    try {
      const html = buildExternalFinancialTableReportPrintHtml({
        rows: activeRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentExternalFinancialReportMeta(),
      });
      await printReportHtml(html);
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print external financial report.");
    }
  };

  const handleExportExternalFinancialExcel = async () => {
    try {
      await downloadExternalFinancialTableReportExcel({
        rows: activeRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentExternalFinancialReportMeta(),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_external_financial_entries",
        description: "Exported external financial report as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export external financial report.");
    }
  };

  const handlePrintExternalFinancialDetail = async () => {
    if (!selectedRow) return;

    try {
      const html = buildExternalFinancialDetailReportPrintHtml({
        entry: selectedRow,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html);
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print external financial detail.");
    }
  };

  const columns = useMemo<InventoryDataTableColumn<ExternalFinancialEntry>[]>(
    () => [
      { key: "date", title: "Date", weight: 14, sortable: true, sortValue: (row) => row.entry_date, render: (row) => <Text style={styles.rowCell}>{formatDate(row.entry_date)}</Text> },
      { key: "type", title: "Type", weight: 12, sortable: true, sortValue: (row) => row.entry_type, render: (row) => <Text style={styles.rowCell}>{row.entry_type}</Text> },
      { key: "source", title: "Source", weight: 22, sortable: true, sortValue: (row) => row.entry_source || "", render: (row) => <Text style={styles.rowCell}>{displayText(row.entry_source)}</Text> },
      { key: "notes", title: "Notes", weight: 24, sortable: true, sortValue: (row) => row.notes || "", render: (row) => <Text style={styles.rowCell}>{row.notes || "-"}</Text> },
      { key: "amount", title: "Amount", weight: 14, align: "right", sortable: true, sortValue: (row) => Number(row.amount || 0), render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.amount)}</Text> },
      {
        key: "action",
        title: "Action",
        weight: 18,
        align: "center",
        render: (row, meta) =>
          <View style={[styles.actionCellWrap, openActionEntryId === row.id_external_entry ? styles.actionCellWrapOpen : null]}>
            <InventoryRowActionsMenu
              open={openActionEntryId === row.id_external_entry}
              onToggle={() => setOpenActionEntryId((prev) => (prev === row.id_external_entry ? null : row.id_external_entry))}
              direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
            >
              <Pressable
                style={[styles.actionOutlineBtn, styles.actionOutlineInfo]}
                onPress={() => {
                  setOpenActionEntryId(null);
                  setSelectedRow(row);
                }}
              >
                <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>    
              </Pressable>
              {canManage ? (
                <>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineEdit]}
                    onPress={() => {
                      setOpenActionEntryId(null);
                      openEdit(row);
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>       
                  </Pressable>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineDanger]}
                    onPress={() => {
                      setOpenActionEntryId(null);
                      setPendingAction({ type: "status", row });
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text>
                  </Pressable>
                </>
              ) : null}
            </InventoryRowActionsMenu>
          </View>
      },
    ],
    [canManage, openActionEntryId, openEdit]
  );

  const inactiveColumns = useMemo<InventoryDataTableColumn<ExternalFinancialEntry>[]>(
    () => [
      { key: "date", title: "Date", weight: 14, sortable: true, sortValue: (row) => row.entry_date, render: (row) => <Text style={styles.rowCell}>{formatDate(row.entry_date)}</Text> },
      { key: "type", title: "Type", weight: 12, sortable: true, sortValue: (row) => row.entry_type, render: (row) => <Text style={styles.rowCell}>{row.entry_type}</Text> },
      { key: "source", title: "Source", weight: 24, sortable: true, sortValue: (row) => row.entry_source || "", render: (row) => <Text style={styles.rowCell}>{displayText(row.entry_source)}</Text> },
      { key: "notes", title: "Notes", weight: 28, sortable: true, sortValue: (row) => row.notes || "", render: (row) => <Text style={styles.rowCell}>{row.notes || "-"}</Text> },
      { key: "amount", title: "Amount", weight: 16, align: "right", sortable: true, sortValue: (row) => Number(row.amount || 0), render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.amount)}</Text> },
      {
        key: "action",
        title: "Action",
        weight: 14,
        align: "center",
        render: (row) =>
          canManage ? (
          <Pressable style={styles.activateButton} onPress={() => setPendingAction({ type: "status", row })}>
            <Text style={styles.activateButtonText}>Activate</Text>
          </Pressable>
          ) : null,
      },
    ],
    [canManage]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="External Financial"
        subtitle="Manage external income and outcome entries used by SHU calculations."
        action={
          <View style={styles.headerActionRow}>
            <ExportDropdownMenu
              onExportPdf={handlePrintExternalFinancialTable}
              onExportExcel={handleExportExternalFinancialExcel}
              onSendEmail={() => {
                setEmailTarget("table");
                setEmailModalOpen(true);
              }}
            />
            {canManage ? (
              <>
              <Pressable style={styles.secondaryButton} onPress={() => setInactiveOpen(true)}>
                <Text style={styles.secondaryButtonText}>Show Inactive</Text>
              </Pressable>
              <PrimaryActionButton label="Add Entry" onPress={openCreate} />
              </>
            ) : null}
          </View>
        }
      />

      <InventoryFilterSection
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search source, notes, type, or date"
        onOpenFilter={() => {
          setDraftTypeFilter(typeFilter);
          setDraftDateStartFilter(dateStartFilter);
          setDraftDateEndFilter(dateEndFilter);
          setDraftMinAmountFilter(minAmountFilter);
          setDraftMaxAmountFilter(maxAmountFilter);
          setFilterOpen(true);
        }}
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setTypeFilter("ALL");
          setDraftTypeFilter("ALL");
          setDateStartFilter("");
          setDateEndFilter("");
          setMinAmountFilter("");
          setMaxAmountFilter("");
          setDraftDateStartFilter("");
          setDraftDateEndFilter("");
          setDraftMinAmountFilter("");
          setDraftMaxAmountFilter("");
        }}
      />

      <InventoryDataTable
        columns={columns}
        rows={activeRows}
        rowKey={(row) => row.id_external_entry}
        isRowActive={(row) => openActionEntryId === row.id_external_entry}
        emptyText="No external financial entries found."
      />

      <FilterSheetModal
        title="Filter External Financial"
        visible={filterOpen}
        onApply={() => {
          if (draftDateStartFilter && draftDateEndFilter && draftDateEndFilter < draftDateStartFilter) {        
            showResult("error", "Validation", "End date must be the same as or after start date.");
            return;
          }
          setTypeFilter(draftTypeFilter);
          setDateStartFilter(draftDateStartFilter);
          setDateEndFilter(draftDateEndFilter);
          setMinAmountFilter(draftMinAmountFilter);
          setMaxAmountFilter(draftMaxAmountFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftTypeFilter("ALL");
          setTypeFilter("ALL");
          setDraftDateStartFilter("");
          setDraftDateEndFilter("");
          setDraftMinAmountFilter("");
          setDraftMaxAmountFilter("");
          setDateStartFilter("");
          setDateEndFilter("");
          setMinAmountFilter("");
          setMaxAmountFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Type"
          value={draftTypeFilter}
          options={["ALL", "INCOME", "OUTCOME"].map((item) => ({ label: item, value: item }))}
          onChange={setDraftTypeFilter}
        />
        <Text style={styles.filterLabel}>Date Range</Text>
        <View style={styles.rangeRow}>
          <View style={styles.rangeField}>
            <DatePickerField
              label="Start Date"
              value={draftDateStartFilter}
              placeholder="Select start date"
              onChange={setDraftDateStartFilter}
              maximumDate={draftDateEndFilter ? new Date(`${draftDateEndFilter}T00:00:00`) : undefined}
            />
          </View>
          <View style={styles.rangeField}>
            <DatePickerField
              label="End Date"
              value={draftDateEndFilter}
              placeholder="Select end date"
              onChange={setDraftDateEndFilter}
              minimumDate={draftDateStartFilter ? new Date(`${draftDateStartFilter}T00:00:00`) : undefined}     
            />
          </View>
        </View>
        <Text style={styles.filterLabel}>Amount Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinAmountFilter}
            onChangeText={(value) => setDraftMinAmountFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxAmountFilter}
            onChangeText={(value) => setDraftMaxAmountFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
      </FilterSheetModal>

      <ResponsiveModal
        visible={inactiveOpen}
        onClose={() => setInactiveOpen(false)}
        maxWidthDesktop={900}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.inactiveModalCard}
      >
        <Text style={styles.modalTitle}>Inactive External Financial Entries</Text>
        <ScrollView contentContainerStyle={styles.formBody} showsVerticalScrollIndicator={false}>
          <InventoryDataTable
            columns={inactiveColumns}
            rows={inactiveRows}
            rowKey={(row) => row.id_external_entry}
            emptyText="No inactive external financial entries found."
          />
        </ScrollView>
        <Pressable style={styles.closeButton} onPress={() => setInactiveOpen(false)}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        maxWidthDesktop={640}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
        <View style={styles.detailModalHeader}>
          <Text style={styles.modalTitle}>External Financial Detail</Text>
          <ExportDropdownMenu
            variant="detail"
            onExportPdf={handlePrintExternalFinancialDetail}
            onSendEmail={() => {
              setEmailTarget("detail");
              setEmailModalOpen(true);
            }}
          />
        </View>
        <ScrollView contentContainerStyle={styles.formBody} showsVerticalScrollIndicator={false}>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}><Text style={styles.detailLabel}>Date</Text><Text style={styles.detailValue}>{formatDate(selectedRow?.entry_date || "")}</Text></View>
            <View style={styles.detailItem}><Text style={styles.detailLabel}>Type</Text><Text style={styles.detailValue}>{selectedRow?.entry_type || "-"}</Text></View>
            <View style={styles.detailItem}><Text style={styles.detailLabel}>Source</Text><Text style={styles.detailValue}>{displayText(selectedRow?.entry_source)}</Text></View>
            <View style={styles.detailItem}><Text style={styles.detailLabel}>Amount</Text><Text style={styles.detailValue}>{formatRupiah(Number(selectedRow?.amount || 0))}</Text></View>
            <View style={[styles.detailItem, styles.detailItemFull]}><Text style={styles.detailLabel}>Notes</Text><Text style={styles.detailValue}>{selectedRow?.notes || "-"}</Text></View>
          </View>
        </ScrollView>
        <Pressable style={styles.closeButton} onPress={() => setSelectedRow(null)}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        maxWidthDesktop={520}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>{editingRow ? "Edit External Financial Entry" : "Add External Financial Entry"}</Text>
        <ScrollView contentContainerStyle={styles.formBody} showsVerticalScrollIndicator={false}>
          <FilterSelectField
            label="Type"
            value={form.entry_type}
            options={["INCOME", "OUTCOME"].map((item) => ({ label: item, value: item }))}
            onChange={(value) => setForm((prev) => ({ ...prev, entry_type: value as "INCOME" | "OUTCOME" }))}   
          />
          <DatePickerField label="Date" value={form.entry_date} onChange={(value) => setForm((prev) => ({ ...prev, entry_date: value }))} />
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Source</Text>
            <TextInput value={form.entry_source} onChangeText={(value) => setForm((prev) => ({ ...prev, entry_source: value }))} style={styles.input} placeholder="Source" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Amount</Text>
            <TextInput value={form.amount} onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value.replace(/[^0-9]/g, "") }))} style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Notes</Text>
            <TextInput value={form.notes} onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))} style={styles.input} placeholder="Optional notes" placeholderTextColor="#94a3b8" />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={() => setFormOpen(false)} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.submitBtn} onPress={() => setPendingAction({ type: "save" })} disabled={saving}>
            <Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

      <InventoryConfirmModal
        visible={Boolean(pendingAction)}
        title="Please Confirm"
        message={getPendingActionMessage()}
        confirmLabel={pendingAction?.type === "status" && pendingAction.row.is_active === "Y" ? "Deactivate" : "Yes, Continue"}
        tone={pendingAction?.type === "status" && pendingAction.row.is_active === "Y" ? "danger" : pendingAction?.type === "status" ? "success" : "primary"}
        loading={saving}
        onCancel={() => (saving ? null : setPendingAction(null))}
        onConfirm={executePendingAction}
      />

      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "External Financial List" : "External Financial Detail"}
        onSend={handleSendEmailReport}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  secondaryButton: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  rowCell: { color: "#0f172a", fontSize: 12 },
  actionCellWrap: { alignItems: "center", justifyContent: "center" },
  actionCellWrapOpen: { position: "relative", zIndex: 4000 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  activateButton: { alignSelf: "center", minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  activateButtonText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  inactiveModalCard: { width: "100%", backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },        
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  detailPrintButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrintButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  formBody: { gap: 10, paddingBottom: 6 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  detailItem: { width: "49%", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  detailItemFull: { width: "100%" },
  detailLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  detailValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  fieldWrap: { gap: 6 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700" },
  input: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  rangeRow: { flexDirection: "row", gap: 8 },
  rangeField: { flex: 1 },
  rangeInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, color: "#0f172a" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  closeButton: { marginTop: 8, height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
