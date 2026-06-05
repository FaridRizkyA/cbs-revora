import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportNestedTable,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type ShuYearReportRow = {
  id_shu_period: string;
  period_name: string;
  start_date: string | Date;
  end_date: string | Date;
  calculation_status: string;
  display_status: string;
  total_shu_distributed_amount: number;
  total_manager_fund_amount: number;
  gross_profit_display: number;
};

export type ShuDetailReportData = {
  period: {
    id_shu_period?: string;
    period_name: string;
    start_date: string | Date;
    end_date: string | Date;
    calculation_status?: string;
    gross_profit_display?: number;
    total_shu_distributed_amount?: number;
    total_manager_fund_amount?: number;
  };
  monthly_income: {
    month: string;
    sales_turnover_amount: number;
    external_income_amount: number;
    total_income_amount: number;
  }[];
  yearly_expenses: {
    expense_date: string | Date;
    expense_type: string;
    source: string;
    notes?: string | null;
    amount: number;
  }[];
  member_distributions: {
    member_code?: string | null;
    full_name?: string | null;
    is_active?: string | null;
    member_total_spending: number;
    spending_percentage: number;
    eligible_shu_usaha: boolean;
    shu_belanja_amount: number;
    shu_usaha_amount: number;
    shu_amount: number;
  }[];
  officer_distributions: {
    officer_role_code: string;
    shu_amount: number;
  }[];
  remaining_shu: {
    gross_profit_amount: number;
    member_distributed_amount: number;
    officer_distributed_amount: number;
    remaining_shu_amount: number;
  };
};

export type ShuSignatureSlot = {
  label: string;
  name?: string | null;
  position: string;
};

export type ShuYearReportOptions = {
  rows: ShuYearReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type ShuDetailReportOptions = {
  detail: ShuDetailReportData;
  signatures?: ShuSignatureSlot[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "shu";

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");

const formatDateOnly = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const percentText = (value: number) => `${(Number(value || 0) * 100).toFixed(2)}%`;
const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

const sumBy = <Row,>(rows: Row[], getValue: (row: Row) => number) =>
  rows.reduce((total, row) => total + Number(getValue(row) || 0), 0);

const yearlyColumns: ReportTableColumn<ShuYearReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "period",
    title: "Period",
    getValue: (row) => `${row.period_name} (${formatDateOnly(row.start_date)} - ${formatDateOnly(row.end_date)})`,
  },
  {
    key: "status",
    title: "Status",
    align: "center",
    width: "13%",
    getValue: (row) => row.display_status || row.calculation_status,
  },
  {
    key: "profit",
    title: "Net Profit",
    align: "right",
    width: "18%",
    getValue: (row) => formatRupiah(row.gross_profit_display),
  },
  {
    key: "member_shu",
    title: "Member SHU",
    align: "right",
    width: "18%",
    getValue: (row) => formatRupiah(row.total_shu_distributed_amount),
  },
  {
    key: "officer_shu",
    title: "Officer SHU",
    align: "right",
    width: "18%",
    getValue: (row) => formatRupiah(row.total_manager_fund_amount),
  },
];

export const buildShuYearlyReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildShuDetailReportPdfFileName = (
  detail: Pick<ShuDetailReportData, "period">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: detail.period.period_name,
    date,
  });

export const buildShuYearlyReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ShuYearReportOptions) =>
  buildReportTablePrintHtml({
    title: "SHU Yearly Summary Report",
    subtitle: "Patronage refund yearly summary",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: yearlyColumns,
    emptyText: "No SHU yearly summary data found.",
  });

const defaultSignatures: ShuSignatureSlot[] = [
  { label: "Prepared By", name: null, position: "Cooperative Treasurer" },
  { label: "Acknowledged By", name: null, position: "Cooperative Chairperson" },
  { label: "Acknowledged By", name: null, position: "Supervisor" },
  { label: "Approved By", name: null, position: "Cooperative Advisor" },
];

const signatureValue = (signature: ShuSignatureSlot) =>
  `\n\n\n\n${signature.name || "[name]"}\n${signature.position}`;

const buildDetailTables = (detail: ShuDetailReportData, signatures: ShuSignatureSlot[] = defaultSignatures): ReportNestedTable[] => {
  const activeMemberDistributions = detail.member_distributions.filter((row) => row.is_active !== "N");
  const totalIncome = sumBy(detail.monthly_income, (row) => row.total_income_amount);
  const totalExpenses = sumBy(detail.yearly_expenses, (row) => row.amount);
  const totalMemberSpending = sumBy(activeMemberDistributions, (row) => row.member_total_spending);
  const totalShuBelanja = sumBy(activeMemberDistributions, (row) => row.shu_belanja_amount);
  const totalSpendingPercentage = sumBy(activeMemberDistributions, (row) => row.spending_percentage);
  const totalShuUsaha = sumBy(activeMemberDistributions, (row) => row.shu_usaha_amount);
  const totalMemberShu = sumBy(activeMemberDistributions, (row) => row.shu_amount);
  const totalOfficerShu = sumBy(detail.officer_distributions, (row) => row.shu_amount);

  return [
    {
      title: "Monthly Income",
      emptyText: "No monthly income data.",
      columns: [
        { key: "month", title: "Month", width: "18%" },
        { key: "sales_turnover_amount", title: "Sales Turnover", align: "right" },
        { key: "external_income_amount", title: "External Income", align: "right" },
        { key: "total_income_amount", title: "Total Income", align: "right" },
      ],
      rows: detail.monthly_income.map((row) => ({
        month: row.month,
        sales_turnover_amount: formatRupiah(row.sales_turnover_amount),
        external_income_amount: formatRupiah(row.external_income_amount),
        total_income_amount: formatRupiah(row.total_income_amount),
      })),
      footerRows: [
        {
          cells: [
            { value: "Total Income", colspan: 3, align: "right" },
            { value: formatRupiah(totalIncome), align: "right" },
          ],
        },
      ],
    },
    {
      title: "Yearly Expenses",
      repeatReportHeader: true,
      breakBefore: true,
      emptyText: "No yearly expense data.",
      columns: [
        { key: "expense_date", title: "Date", width: "14%" },
        { key: "expense_type", title: "Type", width: "15%" },
        { key: "source", title: "Source", width: "20%" },
        { key: "notes", title: "Notes" },
        { key: "amount", title: "Amount", align: "right", width: "18%" },
      ],
      rows: detail.yearly_expenses.map((row) => ({
        expense_date: formatDateOnly(row.expense_date),
        expense_type: displayText(row.expense_type),
        source: displayText(row.source),
        notes: row.notes,
        amount: formatRupiah(row.amount),
      })),
      footerRows: [
        {
          cells: [
            { value: "Total Expenses", colspan: 4, align: "right" },
            { value: formatRupiah(totalExpenses), align: "right" },
          ],
        },
      ],
    },
    {
      title: "Member SHU Distribution",
      repeatReportHeader: true,
      breakBefore: true,
      emptyText: "No member distribution data.",
      columns: [
        { key: "row_number", title: "No.", align: "center", width: "42px" },
        { key: "full_name", title: "Member", width: "22%" },
        { key: "member_total_spending", title: "Spending", align: "right", width: "15%" },
        { key: "shu_belanja_amount", title: "Shopping SHU", align: "right", width: "15%" },
        { key: "spending_percentage", title: "SHU %", align: "right", width: "10%" },
        { key: "shu_usaha_amount", title: "Business SHU", align: "right", width: "15%" },
        { key: "shu_amount", title: "SHU Total", align: "right", width: "15%" },
      ],
      rows: activeMemberDistributions.map((row, index) => ({
        row_number: index + 1,
        full_name: row.full_name,
        member_total_spending: formatRupiah(row.member_total_spending),
        shu_belanja_amount: formatRupiah(row.shu_belanja_amount),
        spending_percentage: percentText(row.spending_percentage),
        shu_usaha_amount: formatRupiah(row.shu_usaha_amount),
        shu_amount: formatRupiah(row.shu_amount),
      })),
      footerRows: [
        {
          cells: [
            { value: "Total", colspan: 2, align: "right" },
            { value: formatRupiah(totalMemberSpending), align: "right" },
            { value: formatRupiah(totalShuBelanja), align: "right" },
            { value: percentText(totalSpendingPercentage), align: "right" },
            { value: formatRupiah(totalShuUsaha), align: "right" },
            { value: formatRupiah(totalMemberShu), align: "right" },
          ],
        },
      ],
    },
    {
      title: "Officer SHU Distribution",
      repeatReportHeader: true,
      breakBefore: true,
      emptyText: "No officer distribution data.",
      columns: [
        { key: "row_number", title: "No.", align: "center", width: "42px" },
        { key: "officer_role_code", title: "Officer Role" },
        { key: "shu_amount", title: "SHU Amount", align: "right", width: "22%" },
      ],
      rows: detail.officer_distributions.map((row, index) => ({
        row_number: index + 1,
        officer_role_code: displayText(row.officer_role_code),
        shu_amount: formatRupiah(row.shu_amount),
      })),
      footerRows: [
        {
          cells: [
            { value: "Total Distributed Amount", colspan: 2, align: "right" },
            { value: formatRupiah(totalOfficerShu), align: "right" },
          ],
        },
      ],
    },
    {
      title: "Financial Summary",
      emptyText: "No financial summary data.",
      columns: [
        { key: "label", title: "Summary Item" },
        { key: "value", title: "Amount", align: "right", width: "28%" },
      ],
      rows: [
        { label: "Total Income", value: formatRupiah(totalIncome) },
        { label: "Total Outcome", value: formatRupiah(totalExpenses) },
        { label: "Net Profit", value: formatRupiah(detail.remaining_shu.gross_profit_amount) },
        { label: "Distributed Member SHU", value: formatRupiah(detail.remaining_shu.member_distributed_amount) },
        { label: "Distributed Officer SHU", value: formatRupiah(detail.remaining_shu.officer_distributed_amount) },
        { label: "Remaining SHU", value: formatRupiah(detail.remaining_shu.remaining_shu_amount) },
      ],
    },
    {
      title: "Signature Area",
      emptyText: "No signature data.",
      columns: [
        { key: "created_by", title: "Prepared By" },
        { key: "known_by_1", title: "Acknowledged By" },
        { key: "known_by_2", title: "Acknowledged By" },
        { key: "approved_by", title: "Approved By" },
      ],
      rows: [
        {
          created_by: signatureValue(signatures[0] || defaultSignatures[0]),
          known_by_1: signatureValue(signatures[1] || defaultSignatures[1]),
          known_by_2: signatureValue(signatures[2] || defaultSignatures[2]),
          approved_by: signatureValue(signatures[3] || defaultSignatures[3]),
        },
      ],
    },
  ];
};

export const buildShuDetailReportPrintHtml = ({
  detail,
  signatures = defaultSignatures,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ShuDetailReportOptions) =>
  buildReportDetailPrintHtml({
    title: "SHU Detail Report",
    subtitle: "Patronage refund calculation detail",
    reportKey: REPORT_KEY,
    documentNumber: detail.period.period_name,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Period Information",
        fields: [
          { label: "Period", value: detail.period.period_name },
          { label: "Start Date", value: formatDateOnly(detail.period.start_date) },
          { label: "End Date", value: formatDateOnly(detail.period.end_date) },
          { label: "Status", value: detail.period.calculation_status },
        ],
      },
    ],
    tables: buildDetailTables(detail, signatures),
  });
