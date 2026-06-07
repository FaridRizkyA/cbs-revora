import {
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type SalesCostReportRow = {
  id_stock_in_item?: string;
  stock_in_code: string;
  product_name: string;
  batch_code?: string | null;
  supplier_name?: string | null;
  quantity: number;
  buy_per_pcs: number;
  total_cost: number;
  received_by_name?: string | null;
  stock_in_date: string | Date;
};

export type SalesCostReportOptions = {
  rows: SalesCostReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "sales-cost";

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

export const salesCostTableColumns: ReportTableColumn<SalesCostReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "stock_in_code",
    title: "Stock In Code",
    width: "18%",
    getValue: (row) => row.stock_in_code,
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
    key: "buy_per_pcs",
    title: "Buy/Pcs",
    align: "right",
    width: "13%",
    getValue: (row) => formatRupiah(Number(row.buy_per_pcs || 0)),
  },
  {
    key: "total_cost",
    title: "Total Cost",
    align: "right",
    width: "14%",
    getValue: (row) => formatRupiah(Number(row.total_cost || 0)),
  },
  {
    key: "supplier_name",
    title: "Supplier",
    width: "14%",
    getValue: (row) => row.supplier_name,
  },
  {
    key: "stock_in_date",
    title: "Date",
    width: "15%",
    getValue: (row) => formatDateTime(row.stock_in_date),
  },
];

export const buildSalesCostTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildSalesCostTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SalesCostReportOptions) =>
  buildReportTablePrintHtml({
    title: "Sales Cost Report",
    subtitle: "Stock purchase costs from stock-in items",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: salesCostTableColumns,
    emptyText: "No sales cost data found.",
  });

export const downloadSalesCostTableReportExcel = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SalesCostReportOptions) =>
  downloadReportTableExcel({
    title: "Sales Cost Report",
    subtitle: "Stock purchase costs from stock-in items",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: salesCostTableColumns,
    emptyText: "No sales cost data found.",
  });
