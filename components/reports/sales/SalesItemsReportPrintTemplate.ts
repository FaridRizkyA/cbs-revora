import {
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";
import { buildExcelFileName, buildExcelTableHtmlWithEmbeddedLogos, ExcelColumn } from "../../../utils/excelExport";

export type SalesItemReportRow = {
  id_sale_item?: string;
  sale_code: string;
  product_name: string;
  quantity: number;
  sell_per_pcs: number;
  total_sell: number;
  cashier_name?: string | null;
  sale_date: string | Date;
};

export type SalesItemsReportOptions = {
  rows: SalesItemReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-sales-items";

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export const salesItemsTableColumns: ReportTableColumn<SalesItemReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "sale_code",
    title: "Sale Code",
    width: "20%",
    getValue: (row) => row.sale_code,
  },
  {
    key: "product_name",
    title: "Product",
    getValue: (row) => row.product_name,
  },
  {
    key: "quantity",
    title: "Qty",
    align: "center",
    width: "8%",
    getValue: (row) => row.quantity,
  },
  {
    key: "sell_per_pcs",
    title: "Price",
    align: "right",
    width: "13%",
    getValue: (row) => formatRupiah(Number(row.sell_per_pcs || 0)),
  },
  {
    key: "total_sell",
    title: "Total Sell",
    align: "right",
    width: "14%",
    getValue: (row) => formatRupiah(Number(row.total_sell || 0)),
  },
  {
    key: "cashier_name",
    title: "Cashier",
    width: "13%",
    getValue: (row) => row.cashier_name,
  },
  {
    key: "sale_date",
    title: "Date",
    width: "15%",
    getValue: (row) => formatDateTime(row.sale_date),
  },
];

export const salesItemsExcelColumns: ExcelColumn<SalesItemReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    width: 8,
    align: "center",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "sale_code",
    title: "Sale Code",
    width: 22,
    getValue: (row) => row.sale_code,
  },
  {
    key: "product_name",
    title: "Product",
    width: 30,
    getValue: (row) => row.product_name,
  },
  {
    key: "quantity",
    title: "Qty",
    width: 10,
    align: "center",
    getValue: (row) => row.quantity,
  },
  {
    key: "sell_per_pcs",
    title: "Price",
    width: 16,
    align: "right",
    getValue: (row) => Number(row.sell_per_pcs || 0),
  },
  {
    key: "total_sell",
    title: "Total Sell",
    width: 18,
    align: "right",
    getValue: (row) => Number(row.total_sell || 0),
  },
  {
    key: "cashier_name",
    title: "Cashier",
    width: 20,
    getValue: (row) => row.cashier_name,
  },
  {
    key: "sale_date",
    title: "Date",
    width: 20,
    getValue: (row) => formatDateTime(row.sale_date),
  },
];

export const buildSalesItemsTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildSalesItemsTableExcelFileName = (date?: string | Date | null) =>
  buildExcelFileName(REPORT_KEY, date);

export const buildSalesItemsTableExcelHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SalesItemsReportOptions) =>
  buildExcelTableHtmlWithEmbeddedLogos({
    title: "Sales Items Report",
    subtitle: "Sold products from sales transactions",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta,
    rows,
    columns: salesItemsExcelColumns,
  });

export const buildSalesItemsTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SalesItemsReportOptions) =>
  buildReportTablePrintHtml({
    title: "Sales Items Report",
    subtitle: "Sold products from sales transactions",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: salesItemsTableColumns,
    emptyText: "No sales item data found.",
  });
