import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type StockInReportRow = {
  id_stock_in?: string;
  stock_in_code: string;
  stock_in_date: string | Date;
  notes?: string | null;
  supplier_name: string;
  received_by_name?: string | null;
  product_names?: string[];
  item_count: number;
  total_qty: number;
};

export type StockInReportItemRow = {
  id_stock_in_item?: string;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  purchase_price?: number | null;
  quantity: number;
  expired_date: string | Date;
};

export type StockInDetailReportRow = {
  id_stock_in?: string;
  stock_in_code: string;
  stock_in_date: string | Date;
  notes?: string | null;
  supplier_name: string;
  received_by_name?: string | null;
  items: StockInReportItemRow[];
};

export type StockInReportOptions = {
  rows: StockInReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type StockInDetailReportOptions = {
  document: StockInDetailReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-stock-in";

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

const stockInTableColumns: ReportTableColumn<StockInReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "48px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "stock_in_code",
    title: "Stock In Code",
    width: "22%",
    getValue: (row) => row.stock_in_code,
  },
  {
    key: "supplier_name",
    title: "Supplier",
    getValue: (row) => row.supplier_name,
  },
  {
    key: "received_by_name",
    title: "Receiver",
    width: "18%",
    getValue: (row) => row.received_by_name,
  },
  {
    key: "item_count",
    title: "Items",
    align: "center",
    width: "10%",
    getValue: (row) => row.item_count,
  },
  {
    key: "total_qty",
    title: "Total Qty",
    align: "center",
    width: "12%",
    getValue: (row) => row.total_qty,
  },
  {
    key: "stock_in_date",
    title: "Date",
    width: "18%",
    getValue: (row) => formatDateTime(row.stock_in_date),
  },
];

export const buildStockInTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildStockInDetailReportPdfFileName = (
  document: Pick<StockInDetailReportRow, "stock_in_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: document.stock_in_code,
    date,
  });

export const buildStockInTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockInReportOptions) =>
  buildReportTablePrintHtml({
    title: "Stock In Report",
    subtitle: "Inventory stock in documents",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: stockInTableColumns,
    emptyText: "No stock in data found.",
  });

export const buildStockInDetailReportPrintHtml = ({
  document,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockInDetailReportOptions) => {
  const totalBuy = document.items.reduce(
    (sum, item) => sum + Number(item.purchase_price || 0) * Number(item.quantity || 0),
    0
  );
  const totalQty = document.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return buildReportDetailPrintHtml({
    title: "Stock In Detail",
    subtitle: "Inventory stock in document",
    reportKey: REPORT_KEY,
    documentNumber: document.stock_in_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Stock In Information",
        fields: [
          { label: "Stock In Code", value: document.stock_in_code },
          { label: "Supplier", value: document.supplier_name },
          { label: "Receiver", value: document.received_by_name },
          { label: "Date", value: formatDateTime(document.stock_in_date) },
          { label: "Item Count", value: document.items.length },
          { label: "Total Qty", value: totalQty },
          { label: "Total Buy", value: formatRupiah(totalBuy) },
          { label: "Notes", value: document.notes },
        ],
      },
    ],
    tables: [
      {
        title: "Stock In Items",
        emptyText: "No stock in items.",
        columns: [
          { key: "row_number", title: "No.", align: "center", width: "48px" },
          { key: "product_code", title: "Product Code", width: "16%" },
          { key: "product_name", title: "Product" },
          { key: "batch_code", title: "Batch", width: "18%" },
          { key: "quantity", title: "Qty", align: "center", width: "10%" },
          { key: "purchase_price", title: "Buy / Pcs", align: "right", width: "16%" },
          { key: "expired_date", title: "Expired", width: "14%" },
          { key: "line_total", title: "Total Buy", align: "right", width: "16%" },
        ],
        rows: document.items.map((item, index) => ({
          row_number: index + 1,
          product_code: item.product_code,
          product_name: item.product_name,
          batch_code: item.batch_code,
          quantity: item.quantity,
          purchase_price: formatRupiah(Number(item.purchase_price || 0)),
          expired_date: formatDateOnly(item.expired_date),
          line_total: formatRupiah(Number(item.purchase_price || 0) * Number(item.quantity || 0)),
        })),
      },
    ],
  });
};
