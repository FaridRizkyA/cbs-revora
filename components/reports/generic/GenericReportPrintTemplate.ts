import {
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
  ReportValue,
} from "../shared/ReportPrintTemplate";

export type GenericReportColumn = {
  key: string;
  title: string;
  align?: "left" | "center" | "right";
};

export type GenericReportRow = Record<string, ReportValue> & {
  id?: string | number;
};

type GenericReportPrintOptions = {
  reportKey: string;
  title: string;
  subtitle?: string;
  columns: GenericReportColumn[];
  rows: GenericReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export const buildGenericReportPdfFileName = (reportKey: string, date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey,
    variant: "table",
    date,
  });

export const buildColumns = (columns: GenericReportColumn[]): ReportTableColumn<GenericReportRow>[] => [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  ...columns.map((column) => ({
    key: column.key,
    title: column.title,
    align: column.align,
    getValue: (row: GenericReportRow) => row[column.key],
  })),
];

export const buildGenericReportPrintHtml = ({
  reportKey,
  title,
  subtitle = "Generated report table",
  columns,
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: GenericReportPrintOptions) =>
  buildReportTablePrintHtml({
    title,
    subtitle,
    reportKey,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: buildColumns(columns),
    emptyText: "No report data found.",
  });

export const downloadGenericReportExcel = ({
  reportKey,
  title,
  subtitle = "Generated report table",
  columns,
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: GenericReportPrintOptions) =>
  downloadReportTableExcel({
    title,
    subtitle,
    reportKey,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: buildColumns(columns),
    emptyText: "No report data found.",
  });
