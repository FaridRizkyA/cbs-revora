import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import InventoryFilterSection from "../../../components/inventory/InventoryFilterSection";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import { InventoryConfirmModal, InventoryResultModal } from "../../../components/inventory/ActionModals";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import {
  buildShuDetailReportPrintHtml,
  buildShuYearlyReportPrintHtml,
  distributionTableColumns,
  buildShuDetailExcelFlattenedRows,
  downloadShuDetailReportExcel,
  downloadShuYearlyReportExcel,
  ShuSignatureSlot,
  shuYearlyColumns,
} from "../../../components/reports/shu";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { formatDate, formatDateTime, formatRupiah } from "../../../components/shu/formatters";
import { ShuHeader } from "../../../components/shu/ShuHeader";
import { ShuMemberCard } from "../../../components/shu/ShuMemberCard";
import { ShuOfficerCard } from "../../../components/shu/ShuOfficerCard";
import { styles } from "../../../components/shu/styles";
import { MemberDistribution, OfficerDistribution, ShuPeriod } from "../../../components/shu/types";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import { logClientActivity } from "../../../utils/activityLog";
import { canManageShu, getAuthSession, normalizeRole } from "../../../utils/authSession";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";
import { printReportHtml } from "../../../utils/printUtils";

type ShuYearRow = {
  id_shu_period: string;
  period_name: string;
  start_date: string;
  end_date: string;
  calculation_status: string;
  display_status: string;
  total_shu_distributed_amount: number;
  total_manager_fund_amount: number;
  gross_profit_display: number;
};

type ShuDetailPayload = {
  period: ShuPeriod & { id_shu_period: string };
  finalize_policy: {
    finalize_allowed: boolean;
    period_end_date: string;
  };
  monthly_income: {
    month: string;
    sales_turnover_amount: number;
    external_income_amount: number;
    total_income_amount: number;
  }[];
  yearly_expenses: {
    expense_date: string;
    expense_type: string;
    source: string;
    notes: string;
    amount: number;
  }[];
  member_distributions: MemberDistribution[];
  officer_distributions: OfficerDistribution[];
  remaining_shu: {
    gross_profit_amount: number;
    member_distributed_amount: number;
    officer_distributed_amount: number;
    remaining_shu_amount: number;
  };
};

type StaffSignatureRow = {
  id_user?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  grade_name?: string | null;
};

const getStaffFullName = (staff?: StaffSignatureRow | null) =>
  staff?.full_name ||
  [staff?.first_name, staff?.last_name].filter(Boolean).join(" ").trim() ||
  staff?.email ||
  null;

const findStaffByGrade = (staffs: StaffSignatureRow[], gradeKeywords: string[]) =>
  staffs.find((staff) => {
    const normalizedGrade = String(staff.grade_name || "").trim().toUpperCase();
    return gradeKeywords.some((keyword) => normalizedGrade.includes(keyword.toUpperCase()));
  });

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

const buildShuSignatureSlots = async (fallbackRoleName: string): Promise<ShuSignatureSlot[]> => {
  const session = await getAuthSession();
  const currentUser = session?.user;
  let staffs: StaffSignatureRow[] = [];

  try {
    const response = await fetchWithAuth("/api/people/staffs");
    const payload = await response.json();
    staffs = Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    staffs = [];
  }

  const currentStaff = staffs.find((staff) => staff.id_user === currentUser?.id_user);
  const currentGradeName = String(currentStaff?.grade_name || "").trim();
  const currentName = getStaffFullName(currentStaff) || currentUser?.full_name || currentUser?.email || null;   
  const normalizedCurrentGrade = currentGradeName.toUpperCase();
  const isCurrentTreasurer = normalizedCurrentGrade.includes("TREASURER");
  const chairperson = findStaffByGrade(staffs, ["CHAIRPERSON"]);
  const supervisor = findStaffByGrade(staffs, ["SUPERVISOR"]);
  const advisor = findStaffByGrade(staffs, ["ADVISOR"]);

  return [
    {
      label: "Prepared By",
      name: currentName,
      position: isCurrentTreasurer ? "Cooperative Treasurer" : currentGradeName || fallbackRoleName,
    },
    {
      label: "Acknowledged By",
      name: getStaffFullName(chairperson),
      position: "Cooperative Chairperson",
    },
    {
      label: "Acknowledged By",
      name: getStaffFullName(supervisor),
      position: "Supervisor",
    },
    {
      label: "Approved By",
      name: getStaffFullName(advisor),
      position: "Cooperative Advisor",
    },
  ];
};

export default function ShuScreen() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ShuYearRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [draftStatusFilter, setDraftStatusFilter] = useState("ALL");
  const [minNetProfitFilter, setMinNetProfitFilter] = useState("");
  const [maxNetProfitFilter, setMaxNetProfitFilter] = useState("");
  const [minMemberShuFilter, setMinMemberShuFilter] = useState("");
  const [maxMemberShuFilter, setMaxMemberShuFilter] = useState("");
  const [minOfficerShuFilter, setMinOfficerShuFilter] = useState("");
  const [maxOfficerShuFilter, setMaxOfficerShuFilter] = useState("");
  const [draftMinNetProfitFilter, setDraftMinNetProfitFilter] = useState("");
  const [draftMaxNetProfitFilter, setDraftMaxNetProfitFilter] = useState("");
  const [draftMinMemberShuFilter, setDraftMinMemberShuFilter] = useState("");
  const [draftMaxMemberShuFilter, setDraftMaxMemberShuFilter] = useState("");
  const [draftMinOfficerShuFilter, setDraftMinOfficerShuFilter] = useState("");
  const [draftMaxOfficerShuFilter, setDraftMaxOfficerShuFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<"calculate" | "finalize" | null>(null);
  const [detailData, setDetailData] = useState<ShuDetailPayload | null>(null);
  const [selectedRow, setSelectedRow] = useState<ShuYearRow | null>(null);
  const [roleName, setRoleName] = useState("CASHIER");
  const [canFinalizeShu, setCanFinalizeShu] = useState(false);
  const [finalizeHintOpen, setFinalizeHintOpen] = useState(false);
  const [pendingPeriodAction, setPendingPeriodAction] = useState<"calculate" | "finalize" | null>(null);
  const [finalizeCountdown, setFinalizeCountdown] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (pendingPeriodAction === "finalize") {
      setFinalizeCountdown(10);
      timer = setInterval(() => {
        setFinalizeCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setFinalizeCountdown(0);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [pendingPeriodAction]);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"table" | "detail">("table");
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

  const canManage = canManageShu(roleName);

  const loadYearlySummary = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth("/api/shu/yearly-summary");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to fetch SHU yearly summary.");
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch SHU yearly summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (row: ShuYearRow) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detailUrl = row.id_shu_period.startsWith("virtual-")
        ? `/api/shu/current-detail?date=${encodeURIComponent(row.start_date)}`
        : `/api/shu/current-detail?id_shu_period=${encodeURIComponent(row.id_shu_period)}`;      
      const res = await fetchWithAuth(detailUrl);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to fetch SHU detail.");
      setDetailData(payload.data || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch SHU detail.";
      if (message.toLowerCase().includes("not calculated yet")) {
        const today = new Date().toISOString().slice(0, 10);
        setDetailData({
          period: {
            id_shu_period: row.id_shu_period,
            period_name: row.period_name,
            start_date: row.start_date,
            end_date: row.end_date,
            calculation_status: row.calculation_status || "DRAFT",
            gross_profit_display: row.gross_profit_display || 0,
            total_shu_distributed_amount: row.total_shu_distributed_amount || 0,
            total_manager_fund_amount: row.total_manager_fund_amount || 0,
          },
          finalize_policy: {
            finalize_allowed: today > row.end_date,
            period_end_date: row.end_date,
          },
          monthly_income: [],
          yearly_expenses: [],
          member_distributions: [],
          officer_distributions: [],
          remaining_shu: {
            gross_profit_amount: row.gross_profit_display || 0,
            member_distributed_amount: row.total_shu_distributed_amount || 0,
            officer_distributed_amount: row.total_manager_fund_amount || 0,
            remaining_shu_amount: (row.gross_profit_display || 0) - (row.total_shu_distributed_amount || 0) - (row.total_manager_fund_amount || 0),
          },
        });
      } else {
        setDetailError(message);
        showResult("error", "Error", message);
        setDetailData(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    getAuthSession()
      .then(async (session) => {
        const nextRole = normalizeRole(session?.user?.role_name) || "CASHIER";
        setRoleName(nextRole);
        if (nextRole === "ADMIN") {
          setCanFinalizeShu(true);
          return;
        }

        const idUser = session?.user?.id_user;
        if (!idUser) {
          setCanFinalizeShu(false);
          return;
        }

        const res = await fetchWithAuth("/api/people/staffs");
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Failed to fetch staff access.");
        const staff = (Array.isArray(payload.data) ? payload.data : []).find((item) => item.id_user === idUser);
        const gradeName = String(staff?.grade_name || "").trim().toUpperCase();
        const accessRole = String(staff?.access_role || "").trim().toUpperCase();
        const officerRoles = Array.isArray(staff?.officer_roles) ? staff.officer_roles : [];
        const hasTreasurerOfficerRole = officerRoles.some((role: any) => String(role.officer_role_code).toUpperCase() === "TREASURER");
        
        setCanFinalizeShu(gradeName.includes("TREASURER") || hasTreasurerOfficerRole || accessRole === "ADMIN");
      })
      .catch(() => {
        setRoleName("CASHIER");
        setCanFinalizeShu(false);
      });
    loadYearlySummary();
  }, [loadYearlySummary]);

  const runPeriodAction = useCallback(
    async (mode: "calculate" | "finalize") => {
      if (!selectedRow) return;
      setRunningAction(mode);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const session = await getAuthSession();
        const idUser = session?.user?.id_user;
        const endpoint = mode === "calculate" ? "calculate-current" : "finalize-current";
        const res = await fetchWithAuth(`/api/shu/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_user: idUser,
            date: selectedRow.start_date,
            now: new Date().toISOString().slice(0, 10),
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || `Failed to ${mode} SHU.`);

        const updatedPeriod = payload.data?.period;
        const nextSelectedRow = updatedPeriod
          ? {
              ...selectedRow,
              id_shu_period: updatedPeriod.id_shu_period || selectedRow.id_shu_period,
              calculation_status: updatedPeriod.calculation_status || selectedRow.calculation_status,
              display_status: updatedPeriod.calculation_status || selectedRow.display_status,
            }
          : selectedRow;

        if (updatedPeriod) {
          setSelectedRow(nextSelectedRow);
          setDetailData((current) =>
            current
              ? {
                  ...current,
                  period: {
                    ...current.period,
                    ...updatedPeriod,
                  },
                }
              : current
          );
        }

        await loadYearlySummary();
        await loadDetail(nextSelectedRow);
        setSuccessMessage(mode === "calculate" ? "SHU recalculation completed." : "SHU finalized successfully.");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : `Failed to ${mode} SHU.`);
      } finally {
        setRunningAction(null);
      }
    },
    [selectedRow, loadYearlySummary, loadDetail]
  );

  const executePendingPeriodAction = async () => {
    const action = pendingPeriodAction;
    setPendingPeriodAction(null);
    if (!action) return;

    if (action === "finalize") {
      // Automatically recalculate before finalizing to ensure data consistency
      await runPeriodAction("calculate");
    }
    
    await runPeriodAction(action);
  };

  const yearlyColumns = useMemo<InventoryDataTableColumn<ShuYearRow>[]>(
    () => [
      {
        key: "period",
        title: "Period",
        weight: 24,
        sortable: true,
        sortValue: (row) => row.start_date,
        render: (row) => (
          <Text style={styles.rowCell}>
            {row.period_name} ({formatDate(row.start_date)} - {formatDate(row.end_date)})
          </Text>
        ),
      },
      { key: "status", title: "Status", weight: 14, align: "center", sortable: true, sortValue: (row) => row.display_status, render: (row) => <Text style={styles.rowCell}>{row.display_status}</Text> },
      { key: "profit", title: "Net Profit", weight: 20, align: "right", sortable: true, sortValue: (row) => row.gross_profit_display, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.gross_profit_display)}</Text> },
      { key: "member_shu", title: "Member SHU", weight: 20, align: "right", sortable: true, sortValue: (row) => row.total_shu_distributed_amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.total_shu_distributed_amount)}</Text> },
      { key: "officer_shu", title: "Officer SHU", weight: 12, align: "right", sortable: true, sortValue: (row) => row.total_manager_fund_amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.total_manager_fund_amount)}</Text> },
      {
        key: "action",
        title: "Action",
        weight: 10,
        align: "center",
        render: (row) => (
          <Pressable
            style={[styles.button, styles.buttonGhost, styles.inlineActionButton]}
            onPress={async () => {
              setSelectedRow(row);
              setDetailOpen(true);
              await loadDetail(row);
            }}
          >
            <Text style={styles.buttonGhostText}>Detail</Text>
          </Pressable>
        ),
      },
    ],
    [loadDetail]
  );

  const statusOptions = useMemo(() => {
    const values = rows.map((row) => row.display_status).filter(Boolean);
    return ["ALL", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minNetProfit = Number(minNetProfitFilter || "0");
    const maxNetProfit = Number(maxNetProfitFilter || "0");
    const minMemberShu = Number(minMemberShuFilter || "0");
    const maxMemberShu = Number(maxMemberShuFilter || "0");
    const minOfficerShu = Number(minOfficerShuFilter || "0");
    const maxOfficerShu = Number(maxOfficerShuFilter || "0");
    return rows.filter((row) => {
      const matchSearch =
        !query ||
        `${row.period_name} ${row.display_status} ${row.calculation_status} ${row.start_date} ${row.end_date}`  
          .toLowerCase()
          .includes(query);
      const matchStatus = statusFilter === "ALL" ? true : row.display_status === statusFilter;
      const matchNetProfitMin = minNetProfitFilter ? row.gross_profit_display >= minNetProfit : true;
      const matchNetProfitMax = maxNetProfitFilter ? row.gross_profit_display <= maxNetProfit : true;
      const matchMemberShuMin = minMemberShuFilter ? row.total_shu_distributed_amount >= minMemberShu : true;   
      const matchMemberShuMax = maxMemberShuFilter ? row.total_shu_distributed_amount <= maxMemberShu : true;   
      const matchOfficerShuMin = minOfficerShuFilter ? row.total_manager_fund_amount >= minOfficerShu : true;   
      const matchOfficerShuMax = maxOfficerShuFilter ? row.total_manager_fund_amount <= maxOfficerShu : true;   
      return (
        matchSearch &&
        matchStatus &&
        matchNetProfitMin &&
        matchNetProfitMax &&
        matchMemberShuMin &&
        matchMemberShuMax &&
        matchOfficerShuMin &&
        matchOfficerShuMax
      );
    });
  }, [
    rows,
    search,
    statusFilter,
    minNetProfitFilter,
    maxNetProfitFilter,
    minMemberShuFilter,
    maxMemberShuFilter,
    minOfficerShuFilter,
    maxOfficerShuFilter,
  ]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (statusFilter !== "ALL") items.push({ key: "status", label: "Status", value: statusFilter, onClear: () => setStatusFilter("ALL") });
    if (minNetProfitFilter) items.push({ key: "minNetProfit", label: "Min Net Profit", value: minNetProfitFilter, onClear: () => setMinNetProfitFilter("") });
    if (maxNetProfitFilter) items.push({ key: "maxNetProfit", label: "Max Net Profit", value: maxNetProfitFilter, onClear: () => setMaxNetProfitFilter("") });
    if (minMemberShuFilter) items.push({ key: "minMemberShu", label: "Min Member SHU", value: minMemberShuFilter, onClear: () => setMinMemberShuFilter("") });
    if (maxMemberShuFilter) items.push({ key: "maxMemberShu", label: "Max Member SHU", value: maxMemberShuFilter, onClear: () => setMaxMemberShuFilter("") });
    if (minOfficerShuFilter) items.push({ key: "minOfficerShu", label: "Min Officer SHU", value: minOfficerShuFilter, onClear: () => setMinOfficerShuFilter("") });
    if (maxOfficerShuFilter) items.push({ key: "maxOfficerShu", label: "Max Officer SHU", value: maxOfficerShuFilter, onClear: () => setMaxOfficerShuFilter("") });
    return items;
  }, [statusFilter, minNetProfitFilter, maxNetProfitFilter, minMemberShuFilter, maxMemberShuFilter, minOfficerShuFilter, maxOfficerShuFilter]);

  const buildCurrentShuReportMeta = () => {
    const items: { label: string; value: string }[] = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (statusFilter !== "ALL") items.push({ label: "Status Filter", value: statusFilter });
    if (minNetProfitFilter) items.push({ label: "Min Net Profit", value: formatRupiah(Number(minNetProfitFilter)) });
    if (maxNetProfitFilter) items.push({ label: "Max Net Profit", value: formatRupiah(Number(maxNetProfitFilter)) });
    if (minMemberShuFilter) items.push({ label: "Min Member SHU", value: formatRupiah(Number(minMemberShuFilter)) });
    if (maxMemberShuFilter) items.push({ label: "Max Member SHU", value: formatRupiah(Number(maxMemberShuFilter)) });
    if (minOfficerShuFilter) items.push({ label: "Min Officer SHU", value: formatRupiah(Number(minOfficerShuFilter)) });
    if (maxOfficerShuFilter) items.push({ label: "Max Officer SHU", value: formatRupiah(Number(maxOfficerShuFilter)) });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const isTable = emailTarget === "table";
      const generatedAt = new Date();
      const signatures = isTable ? [] : await buildShuSignatureSlots(roleName);
      const printHtml = isTable
        ? buildShuYearlyReportPrintHtml({
            rows: filteredRows,
            generatedAt,
            generatedBy: roleName,
            meta: buildCurrentShuReportMeta(),
          })
        : detailData
          ? buildShuDetailReportPrintHtml({
              detail: detailData,
              signatures,
              generatedAt,
              generatedBy: roleName,
            })
          : "";

      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: isTable ? "SHU Yearly Summary Report" : `SHU Detail Report - ${detailData?.period.period_name}`,
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: isTable ? "SHU Yearly Summary Report" : "SHU Detail Report",
        subtitle: isTable ? "Patronage refund yearly summary" : "Patronage refund calculation detail",
        generated_by: roleName,
        print_html: printHtml,
        meta: isTable ? buildCurrentShuReportMeta() : [
          { label: "Period", value: detailData?.period.period_name },
          { label: "Date Range", value: `${formatDate(detailData?.period.start_date || "")} - ${formatDate(detailData?.period.end_date || "")}` },
        ],
        columns: isTable 
          ? shuYearlyColumns.map(c => ({ key: c.key, title: c.title, align: c.align }))
          : (detailData ? buildShuDetailExcelFlattenedRows(detailData, signatures).columns : []),
        rows: isTable 
          ? filteredRows.map((row, idx) => {
              const rowData: any = {};
              shuYearlyColumns.forEach(c => { rowData[c.key] = c.getValue(row, idx); });
              return rowData;
            })
          : (detailData ? buildShuDetailExcelFlattenedRows(detailData, signatures).rows : []),
      };

      const response = await fetchWithAuth("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_shu_periods",
        description: `Sent SHU report via email to ${recipientEmail}.`,
      });

      showResult("success", "Email Sent", "Report has been sent successfully.");
    } catch (error) {
      showResult("error", "Send Failed", error instanceof Error ? error.message : "An error occurred.");
    }
  };

  const handlePrintShuYearlySummary = async () => {
    try {
      const html = buildShuYearlyReportPrintHtml({
        rows: filteredRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentShuReportMeta(),
      });
      await printReportHtml(html, {
        tableName: "tbl_shu_periods",
        description: "Printed SHU yearly summary report.",
        fileName: buildReportPdfFileName({ reportKey: "shu-yearly-summary", variant: "table", date: new Date() }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print SHU yearly summary.");
    }
  };

  const handleExportShuYearlyExcel = async () => {
    try {
      await downloadShuYearlyReportExcel({
        rows: filteredRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentShuReportMeta(),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_shu_periods",
        description: "Exported SHU yearly summary as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export SHU yearly summary.");
    }
  };

  const handlePrintShuDetail = async () => {
    if (!detailData) return;

    try {
      const signatures = await buildShuSignatureSlots(roleName);
      const html = buildShuDetailReportPrintHtml({
        detail: detailData,
        signatures,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html, {
        tableName: "tbl_shu_periods",
        description: `Printed SHU detail report for period ${detailData.period.period_name}.`,
        fileName: buildReportPdfFileName({ 
          reportKey: "shu-detail", 
          variant: "detail", 
          documentNumber: detailData.period.period_name,
          date: new Date() 
        }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print SHU detail.");      
    }
  };

  const handleExportShuDetailExcel = async () => {
    if (!detailData) return;

    try {
      const signatures = await buildShuSignatureSlots(roleName);
      await downloadShuDetailReportExcel({
        detail: detailData,
        signatures,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_shu_periods",
        description: "Exported SHU detail as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export SHU detail.");
    }
  };

  const monthlyIncomeColumns = useMemo<InventoryDataTableColumn<ShuDetailPayload["monthly_income"][number]>[]>( 
    () => [
      { key: "month", title: "Month", weight: 20, sortable: true, sortValue: (row) => row.month, render: (row) => <Text style={styles.rowCell}>{row.month}</Text> },
      { key: "sales", title: "Sales Turnover", weight: 26, align: "right", sortable: true, sortValue: (row) => row.sales_turnover_amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.sales_turnover_amount)}</Text> },
      { key: "external", title: "External Income", weight: 26, align: "right", sortable: true, sortValue: (row) => row.external_income_amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.external_income_amount)}</Text> },
      { key: "total", title: "Total Income", weight: 28, align: "right", sortable: true, sortValue: (row) => row.total_income_amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.total_income_amount)}</Text> },
    ],
    []
  );

  const yearlyExpenseColumns = useMemo<InventoryDataTableColumn<ShuDetailPayload["yearly_expenses"][number]>[]>(
    () => [
      { key: "date", title: "Date", weight: 14, sortable: true, sortValue: (row) => row.expense_date, render: (row) => <Text style={styles.rowCell}>{formatDateTime(row.expense_date)}</Text> },
      { key: "type", title: "Type", weight: 16, sortable: true, sortValue: (row) => row.expense_type, render: (row) => <Text style={styles.rowCell}>{displayText(row.expense_type)}</Text> },
      { key: "source", title: "Source", weight: 20, sortable: true, sortValue: (row) => row.source, render: (row) => <Text style={styles.rowCell}>{row.source}</Text> },
      { key: "notes", title: "Notes", weight: 30, sortable: true, sortValue: (row) => row.notes || "", render: (row) => <Text style={styles.rowCell}>{row.notes || "-"}</Text> },
      { key: "amount", title: "Amount", weight: 20, align: "right", sortable: true, sortValue: (row) => row.amount, render: (row) => <Text style={styles.rowCell}>{formatRupiah(row.amount)}</Text> },
    ],
    []
  );

  const isDetailFinalized = detailData?.period.calculation_status === "FINALIZED";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ShuHeader />

      {loading ? <Text style={styles.stateText}>Loading SHU yearly summary...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      <InventoryFilterSection
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search SHU period or status"
        onOpenFilter={() => {
          setDraftStatusFilter(statusFilter);
          setDraftMinNetProfitFilter(minNetProfitFilter);
          setDraftMaxNetProfitFilter(maxNetProfitFilter);
          setDraftMinMemberShuFilter(minMemberShuFilter);
          setDraftMaxMemberShuFilter(maxMemberShuFilter);
          setDraftMinOfficerShuFilter(minOfficerShuFilter);
          setDraftMaxOfficerShuFilter(maxOfficerShuFilter);
          setFilterOpen(true);
        }}
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setStatusFilter("ALL");
          setDraftStatusFilter("ALL");
          setMinNetProfitFilter("");
          setMaxNetProfitFilter("");
          setMinMemberShuFilter("");
          setMaxMemberShuFilter("");
          setMinOfficerShuFilter("");
          setMaxOfficerShuFilter("");
          setDraftMinNetProfitFilter("");
          setDraftMaxNetProfitFilter("");
          setDraftMinMemberShuFilter("");
          setDraftMaxMemberShuFilter("");
          setDraftMinOfficerShuFilter("");
          setDraftMaxOfficerShuFilter("");
        }}
      />

      <View style={styles.card}>
        <View style={styles.periodHeader}>
          <Text style={styles.cardTitle}>SHU (Patronage Refund) Yearly Summary</Text>
          <ExportDropdownMenu
            onExportPdf={handlePrintShuYearlySummary}
            onExportExcel={handleExportShuYearlyExcel}
            onSendEmail={() => {
              setEmailTarget("table");
              setEmailModalOpen(true);
            }}
          />
        </View>
        <InventoryDataTable
          columns={yearlyColumns}
          rows={filteredRows}
          rowKey={(row) => row.id_shu_period}
          emptyText="No SHU yearly summary available yet."
        />
      </View>

      <FilterSheetModal
        title="Filter SHU"
        visible={filterOpen}
        onApply={() => {
          setStatusFilter(draftStatusFilter);
          setMinNetProfitFilter(draftMinNetProfitFilter);
          setMaxNetProfitFilter(draftMaxNetProfitFilter);
          setMinMemberShuFilter(draftMinMemberShuFilter);
          setMaxMemberShuFilter(draftMaxMemberShuFilter);
          setMinOfficerShuFilter(draftMinOfficerShuFilter);
          setMaxOfficerShuFilter(draftMaxOfficerShuFilter);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftStatusFilter("ALL");
          setStatusFilter("ALL");
          setDraftMinNetProfitFilter("");
          setDraftMaxNetProfitFilter("");
          setDraftMinMemberShuFilter("");
          setDraftMaxMemberShuFilter("");
          setDraftMinOfficerShuFilter("");
          setDraftMaxOfficerShuFilter("");
          setMinNetProfitFilter("");
          setMaxNetProfitFilter("");
          setMinMemberShuFilter("");
          setMaxMemberShuFilter("");
          setMinOfficerShuFilter("");
          setMaxOfficerShuFilter("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        <FilterSelectField
          label="Status"
          value={draftStatusFilter}
          options={statusOptions.map((item) => ({ label: item, value: item }))}
          onChange={setDraftStatusFilter}
        />
        <Text style={styles.filterLabel}>Net Profit Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinNetProfitFilter}
            onChangeText={(value) => setDraftMinNetProfitFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxNetProfitFilter}
            onChangeText={(value) => setDraftMaxNetProfitFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
        <Text style={styles.filterLabel}>Member SHU Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinMemberShuFilter}
            onChangeText={(value) => setDraftMinMemberShuFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxMemberShuFilter}
            onChangeText={(value) => setDraftMaxMemberShuFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
        <Text style={styles.filterLabel}>Officer SHU Range</Text>
        <View style={styles.rangeRow}>
          <TextInput
            value={draftMinOfficerShuFilter}
            onChangeText={(value) => setDraftMinOfficerShuFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
          <TextInput
            value={draftMaxOfficerShuFilter}
            onChangeText={(value) => setDraftMaxOfficerShuFilter(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            style={styles.rangeInput}
          />
        </View>
      </FilterSheetModal>

      <ResponsiveModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidthDesktop={1100}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.92}
        maxHeightPhoneRatio={0.92}
        cardStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>SHU (Patronage Refund) Details</Text>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          {detailLoading ? <Text style={styles.stateText}>Loading SHU details...</Text> : null}
          {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}
          {detailData ? (
            <View style={styles.card}>
              <View style={styles.periodHeader}>
                <Text style={styles.cardTitle}>Finalization and Actions</Text>
                <ExportDropdownMenu
                  variant="detail"
                  onExportPdf={handlePrintShuDetail}
                  onExportExcel={handleExportShuDetailExcel}
                  onSendEmail={() => {
                    setEmailTarget("detail");
                    setEmailModalOpen(true);
                  }}
                />
              </View>
              <View style={styles.statusLine}>
                <Text style={styles.metaText}>Status: {detailData.period.calculation_status || "DRAFT"}</Text>  
                {isDetailFinalized ? (
                  <View style={[styles.statusBadge, styles.statusFinalized]}>
                    <Text style={styles.statusText}>FINALIZED</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.metaText}>Period end date: {formatDate(detailData.finalize_policy.period_end_date)}</Text>
              {isDetailFinalized ? (
                <Text style={styles.finalizedNotice}>SHU data has been finalized. This period snapshot is locked and cannot be recalculated or finalized again.</Text>
              ) : null}
              {canFinalizeShu && !isDetailFinalized ? (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => setPendingPeriodAction("calculate")} disabled={!!runningAction}>
                    <Text style={styles.buttonPrimaryText}>{runningAction === "calculate" ? "Recalculating..." : "Recalculate"}</Text>
                  </Pressable>
                  <View
                    style={styles.finalizeActionWrap}
                    onPointerEnter={() => {
                      if (!detailData.finalize_policy.finalize_allowed) setFinalizeHintOpen(true);
                    }}
                    onPointerLeave={() => setFinalizeHintOpen(false)}
                  >
                    <Pressable
                      style={[
                        styles.button,
                        detailData.finalize_policy.finalize_allowed ? styles.buttonSuccess : styles.buttonMuted,
                        runningAction === "finalize" && styles.buttonDisabled,
                      ]}
                      onPress={() => setPendingPeriodAction("finalize")}
                        disabled={!detailData.finalize_policy.finalize_allowed || !!runningAction}
                      >
                        <Text style={styles.buttonSuccessText}>
                          {runningAction === "finalize" ? "Finalizing..." : "Finalize"}
                        </Text>
                      </Pressable>
                      {!detailData.finalize_policy.finalize_allowed && finalizeHintOpen ? (
                        <View style={styles.actionTooltip}>
                          <Text style={styles.actionTooltipText}>
                            Finalization is not available yet because the period has not ended. It will be available starting D+1 after {formatDate(detailData.finalize_policy.period_end_date)}.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {detailData ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly Income</Text>
              <InventoryDataTable
                columns={monthlyIncomeColumns}
                rows={detailData.monthly_income || []}
                rowKey={(row) => row.month}
                emptyText="No monthly income data."
                enablePagination={false}
                footerValues={
                  !detailData?.monthly_income?.length ? undefined : [
                    <Text style={[styles.rowCell, { fontWeight: "700" }]}>Total</Text>,
                    <Text style={[styles.rowCell, { fontWeight: "700" }]}>{formatRupiah(detailData.monthly_income.reduce((sum, r) => sum + r.sales_turnover_amount, 0))}</Text>,
                    <Text style={[styles.rowCell, { fontWeight: "700" }]}>{formatRupiah(detailData.monthly_income.reduce((sum, r) => sum + r.external_income_amount, 0))}</Text>,
                    <Text style={[styles.rowCell, { fontWeight: "700" }]}>{formatRupiah(detailData.monthly_income.reduce((sum, r) => sum + r.total_income_amount, 0))}</Text>,
                  ]
                }
              />
            </View>
          ) : null}

          {detailData ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Yearly Expenses</Text>
              <InventoryDataTable
                columns={yearlyExpenseColumns}
                rows={detailData.yearly_expenses || []}
                rowKey={(row) => `${row.expense_date}-${row.expense_type}-${row.source}-${row.amount}`}
                emptyText="No yearly expense data."
                footerValues={
                  !detailData?.yearly_expenses?.length ? undefined : [
                    undefined,
                    undefined,
                    undefined,
                    <Text style={[styles.rowCell, { fontWeight: "700", textAlign: "right", width: "100%" }]}>Total Expenses</Text>,
                    <Text style={[styles.rowCell, { fontWeight: "700" }]}>{formatRupiah(detailData.yearly_expenses.reduce((sum, r) => sum + r.amount, 0))}</Text>,
                  ]
                }
              />
            </View>
          ) : null}

          {detailData ? <ShuMemberCard rows={detailData.member_distributions || []} /> : null}

          {detailData ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Retained Earnings Calculation</Text>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net Profit</Text>
                <Text style={styles.summaryValue}>{formatRupiah(detailData.remaining_shu.gross_profit_amount)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Distributed Member SHU</Text>
                <Text style={styles.summaryValue}>{formatRupiah(detailData.remaining_shu.member_distributed_amount)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Distributed Officer SHU</Text>
                <Text style={styles.summaryValue}>{formatRupiah(detailData.remaining_shu.officer_distributed_amount)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Retained Earnings (Sisa SHU)</Text>
                <Text style={styles.summaryValue}>{formatRupiah(detailData.remaining_shu.remaining_shu_amount)}</Text>
              </View>
            </View>
          ) : null}

          {detailData ? <ShuOfficerCard rows={detailData.officer_distributions || []} /> : null}
        </ScrollView>
        <Pressable style={styles.closeBtn} onPress={() => setDetailOpen(false)}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </ResponsiveModal>

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "SHU Yearly Summary" : "SHU Period Detail"}
        onSend={handleSendEmailReport}
      />
      <InventoryConfirmModal
        visible={Boolean(pendingPeriodAction)}
        title={pendingPeriodAction === "finalize" ? "Finalize SHU Period?" : "Recalculate SHU Period?"}
        message={
          pendingPeriodAction === "finalize"
            ? "Finalize this SHU period? This will lock the current calculation snapshot and it cannot be recalculated again."
            : "Recalculate this SHU period using the latest transaction and financial data?"
        }
        confirmLabel={
          pendingPeriodAction === "finalize" 
            ? (finalizeCountdown > 0 ? `Finalize (${finalizeCountdown}s)` : "Finalize Now") 
            : "Recalculate"
        }
        tone={pendingPeriodAction === "finalize" ? "danger" : "primary"}
        loading={!!runningAction}
        confirmDisabled={pendingPeriodAction === "finalize" && finalizeCountdown > 0}
        onCancel={() => (runningAction ? null : setPendingPeriodAction(null))}
        onConfirm={executePendingPeriodAction}
      />
      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </ScrollView>
  );
}
