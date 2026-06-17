import { formatDateTime, formatRupiah } from "../../shu/formatters";
import {
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
  ReportNestedTable,
  buildReportDetailPrintHtml,
} from "../shared/ReportPrintTemplate";
import { downloadExcelSectionWorkbook, flattenExcelSections, ExcelSection } from "../../../utils/excelExport";

export type MemberShuHistoryRow = {
  id_shu_distribution: string;
  id_shu_period?: string;
  period_name: string;
  start_date: string | Date;
  end_date: string | Date;
  calculation_status?: string;
  member_total_spending?: number;
  spending_percentage?: number;
  eligible_business_shu?: boolean;
  sales_shu_amount: number;
  business_shu_amount: number;
  shu_amount: number;
  distribution_status: string;
};

const REPORT_KEY = "member-shu-history";
const DETAIL_REPORT_KEY = "member-shu-slip";

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDateOnly = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const percentText = (value: number) => `${(Number(value || 0) * 100).toFixed(2)}%`;

export const memberShuHistoryColumns: ReportTableColumn<MemberShuHistoryRow>[] = [
  {
    key: "no",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "period_name",
    title: "Period",
    width: "20%",
    getValue: (row) => row.period_name,
  },
  {
    key: "date_range",
    title: "Date Range",
    width: "25%",
    getValue: (row) => `${formatDateOnly(row.start_date)} - ${formatDateOnly(row.end_date)}`,
  },
  {
    key: "sales_shu",
    title: "Sales SHU",
    align: "right",
    width: "15%",
    getValue: (row) => formatRupiah(row.sales_shu_amount),
  },
  {
    key: "business_shu",
    title: "Business SHU",
    align: "right",
    width: "15%",
    getValue: (row) => formatRupiah(row.business_shu_amount),
  },
  {
    key: "total_shu",
    title: "Total SHU",
    align: "right",
    width: "15%",
    getValue: (row) => formatRupiah(row.shu_amount),
  },
  {
    key: "status",
    title: "Status",
    align: "center",
    width: "10%",
    getValue: (row) => row.distribution_status,
  },
];

export const buildMemberShuHistoryReportPrintHtml = ({
  rows,
  memberName,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: {
  rows: MemberShuHistoryRow[];
  memberName: string;
  generatedAt?: Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
}) => {
  const totalSalesShu = rows.reduce((sum, row) => sum + Number(row.sales_shu_amount || 0), 0);
  const totalBusinessShu = rows.reduce((sum, row) => sum + Number(row.business_shu_amount || 0), 0);
  const totalShu = rows.reduce((sum, row) => sum + Number(row.shu_amount || 0), 0);

  return buildReportTablePrintHtml({
    title: "Member SHU History",
    subtitle: memberName,
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Total Distributions", value: String(rows.length) },
      { label: "Total Sales SHU", value: formatRupiah(totalSalesShu) },
      { label: "Total Business SHU", value: formatRupiah(totalBusinessShu) },
      { label: "Total Accumulated SHU", value: formatRupiah(totalShu) },
      ...meta,
    ],
    rows,
    columns: memberShuHistoryColumns,
    emptyText: "No SHU distribution history found.",
  });
};

export const downloadMemberShuHistoryReportExcel = ({
  rows,
  memberName,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: {
  rows: MemberShuHistoryRow[];
  memberName: string;
  generatedAt?: Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
}) => {
  const totalSalesShu = rows.reduce((sum, row) => sum + Number(row.sales_shu_amount || 0), 0);
  const totalBusinessShu = rows.reduce((sum, row) => sum + Number(row.business_shu_amount || 0), 0);
  const totalShu = rows.reduce((sum, row) => sum + Number(row.shu_amount || 0), 0);

  return downloadReportTableExcel({
    title: "Member SHU History",
    subtitle: memberName,
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Total Distributions", value: String(rows.length) },
      { label: "Total Sales SHU", value: formatRupiah(totalSalesShu) },
      { label: "Total Business SHU", value: formatRupiah(totalBusinessShu) },
      { label: "Total Accumulated SHU", value: formatRupiah(totalShu) },
      ...meta,
    ],
    rows,
    columns: memberShuHistoryColumns,
    emptyText: "No SHU distribution history found.",
  });
};

const buildMemberShuDetailTables = (row: MemberShuHistoryRow): ReportNestedTable[] => {
  return [
    {
      title: "Calculation Details",
      emptyText: "No calculation data.",
      columns: [
        { key: "label", title: "Description" },
        { key: "value", title: "Amount", align: "right" },
      ],
      rows: [
        { label: "Total Spending", value: formatRupiah(Number(row.member_total_spending || 0)) },
        { label: "Spending Percentage", value: percentText(Number(row.spending_percentage || 0)) },
        { label: "Sales SHU Amount", value: formatRupiah(Number(row.sales_shu_amount || 0)) },
        { label: "Business SHU Amount", value: formatRupiah(Number(row.business_shu_amount || 0)) },
        { label: "Total SHU Received", value: formatRupiah(Number(row.shu_amount || 0)) },
      ],
    },
  ];
};

export const buildMemberShuDetailReportPrintHtml = ({
  row,
  memberName,
  memberCode,
  generatedAt = new Date(),
  generatedBy,
}: {
  row: MemberShuHistoryRow;
  memberName: string;
  memberCode?: string | null;
  generatedAt?: Date;
  generatedBy?: string | null;
}) => {
  return buildReportDetailPrintHtml({
    title: "SHU Distribution Slip",
    subtitle: row.period_name,
    reportKey: DETAIL_REPORT_KEY,
    documentNumber: memberCode ? `${memberCode}-${row.period_name}` : row.period_name,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Member Name", value: memberName },
      { label: "Member Code", value: memberCode || "-" },
      { label: "Period", value: row.period_name },
      { label: "Status", value: row.distribution_status },
    ],
    sections: [
      {
        title: "Period Information",
        fields: [
          { label: "Period", value: row.period_name },
          { label: "Start Date", value: formatDateOnly(row.start_date) },
          { label: "End Date", value: formatDateOnly(row.end_date) },
          { label: "Distribution Status", value: row.distribution_status },
        ],
      },
    ],
    tables: buildMemberShuDetailTables(row),
  });
};


export const buildMemberShuDetailExcelFlattenedRows = (row: MemberShuDistributionData) => {
  const tables = buildMemberShuDetailTables(row);
  const sections = [
    {
      title: "Period Information",
      columns: [
        { key: "label", title: "Field", width: 22 },
        { key: "value", title: "Value", width: 32 },
      ],
      rows: [
        { label: "Period", value: row.period_name },
        { label: "Start Date", value: formatDateOnly(row.start_date) },
        { label: "End Date", value: formatDateOnly(row.end_date) },
        { label: "Distribution Status", value: row.distribution_status },
      ],
    },
    ...tables.map((table) => ({
      title: table.title,
      columns: table.columns.map((column) => ({
        key: column.key,
        title: column.title,
        align: column.align,
        width: typeof column.width === "number" ? column.width : undefined,
      })),
      rows: table.rows,
    })),
  ];
  return flattenExcelSections(sections as any);
};

export const downloadMemberShuDetailReportExcel = async ({
  row,
  memberName,
  memberCode,
  generatedAt = new Date(),
  generatedBy,
}: {
  row: MemberShuHistoryRow;
  memberName: string;
  memberCode?: string | null;
  generatedAt?: Date;
  generatedBy?: string | null;
}) => {
  const tables = buildMemberShuDetailTables(row);
  await downloadExcelSectionWorkbook({
    title: "SHU Distribution Slip",
    subtitle: row.period_name,
    reportKey: DETAIL_REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Member Name", value: memberName },
      { label: "Member Code", value: memberCode || "-" },
      { label: "Period", value: row.period_name },
      { label: "Status", value: row.distribution_status },
    ],
    sections: [
      {
        title: "Period Information",
        columns: [
          { key: "label", title: "Field", width: 22 },
          { key: "value", title: "Value", width: 32 },
        ],
        rows: [
          { label: "Period", value: row.period_name },
          { label: "Start Date", value: formatDateOnly(row.start_date) },
          { label: "End Date", value: formatDateOnly(row.end_date) },
          { label: "Distribution Status", value: row.distribution_status },
        ],
      },
      ...tables.map((table) => ({
        title: table.title,
        columns: table.columns.map((column) => ({
          key: column.key,
          title: column.title,
          align: column.align,
          width: typeof column.width === "number" ? column.width : undefined,
        })),
        rows: table.rows,
      })),
    ],
  });
};
