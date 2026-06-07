import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type ExternalFinancialReportRow = {
  id_external_entry?: string;
  entry_type: "INCOME" | "OUTCOME" | string;
  entry_date: string | Date;
  entry_source: string;
  amount: number;
  notes?: string | null;
  is_active?: "Y" | "N" | string;
};

export type ExternalFinancialReportOptions = {
  rows: ExternalFinancialReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type ExternalFinancialDetailReportOptions = {
  entry: ExternalFinancialReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "external-financial";

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

const statusText = (value?: string | null) => (value === "Y" ? "Active" : "Inactive");
const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

const calculateSummary = (rows: ExternalFinancialReportRow[]) => {
  const totalIncome = rows
    .filter((row) => row.entry_type === "INCOME")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalOutcome = rows
    .filter((row) => row.entry_type === "OUTCOME")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    totalIncome,
    totalOutcome,
    netAmount: totalIncome - totalOutcome,
  };
};

export const externalFinancialTableColumns: ReportTableColumn<ExternalFinancialReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "entry_date",
    title: "Date",
    width: "14%",
    getValue: (row) => formatDateOnly(row.entry_date),
  },
  {
    key: "entry_type",
    title: "Type",
    width: "13%",
    getValue: (row) => row.entry_type,
  },
  {
    key: "entry_source",
    title: "Source",
    width: "24%",
    getValue: (row) => displayText(row.entry_source),
  },
  {
    key: "notes",
    title: "Notes",
    getValue: (row) => row.notes,
  },
  {
    key: "amount",
    title: "Amount",
    align: "right",
    width: "18%",
    getValue: (row) => formatRupiah(Number(row.amount || 0)),
  },
];

export const buildExternalFinancialTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildExternalFinancialDetailReportPdfFileName = (
  entry: Pick<ExternalFinancialReportRow, "entry_type" | "entry_date">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: `${entry.entry_type}-${formatDateOnly(entry.entry_date)}`,
    date,
  });

export const buildExternalFinancialTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ExternalFinancialReportOptions) => {
  const summary = calculateSummary(rows);

  return buildReportTablePrintHtml({
    title: "External Financial Report",
    subtitle: "External income and outcome entries",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Total Rows", value: rows.length },
      { label: "Total Income", value: formatRupiah(summary.totalIncome) },
      { label: "Total Outcome", value: formatRupiah(summary.totalOutcome) },
      { label: "Net Amount", value: formatRupiah(summary.netAmount) },
      ...meta,
    ],
    rows,
    columns: externalFinancialTableColumns,
    emptyText: "No external financial data found.",
  });
};

export const downloadExternalFinancialTableReportExcel = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ExternalFinancialReportOptions) => {
  const summary = calculateSummary(rows);

  return downloadReportTableExcel({
    title: "External Financial Report",
    subtitle: "External income and outcome entries",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [
      { label: "Total Rows", value: rows.length },
      { label: "Total Income", value: formatRupiah(summary.totalIncome) },
      { label: "Total Outcome", value: formatRupiah(summary.totalOutcome) },
      { label: "Net Amount", value: formatRupiah(summary.netAmount) },
      ...meta,
    ],
    rows,
    columns: externalFinancialTableColumns,
    emptyText: "No external financial data found.",
  });
};

export const buildExternalFinancialDetailReportPrintHtml = ({
  entry,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ExternalFinancialDetailReportOptions) =>
  buildReportDetailPrintHtml({
    title: "External Financial Detail",
    subtitle: "External income and outcome entry",
    reportKey: REPORT_KEY,
    documentNumber: `${entry.entry_type}-${formatDateOnly(entry.entry_date)}`,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Entry Information",
        fields: [
          { label: "Date", value: formatDateOnly(entry.entry_date) },
          { label: "Type", value: entry.entry_type },
          { label: "Source", value: displayText(entry.entry_source) },
          { label: "Amount", value: formatRupiah(Number(entry.amount || 0)) },
          { label: "Notes", value: entry.notes },
          { label: "Status", value: statusText(entry.is_active) },
        ],
      },
    ],
  });
