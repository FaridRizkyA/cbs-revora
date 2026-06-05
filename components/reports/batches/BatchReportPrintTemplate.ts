import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type BatchReportRow = {
  id_product_batch?: string;
  batch_code: string;
  expired_date?: string | Date | null;
  stock_in_time?: string | Date | null;
  product_name: string;
  supplier_name?: string | null;
  qty_in: number;
  current_qty?: number | null;
  purchase_price?: number | null;
};

export type BatchReportOptions = {
  rows: BatchReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type BatchDetailReportOptions = {
  batch: BatchReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-batches";

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

const batchTableColumns: ReportTableColumn<BatchReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "36px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "batch_code",
    title: "Batch Code",
    width: "12%",
    getValue: (row) => row.batch_code,
  },
  {
    key: "product_name",
    title: "Product",
    width: "25%",
    getValue: (row) => row.product_name,
  },
  {
    key: "supplier_name",
    title: "Supplier",
    width: "13%",
    getValue: (row) => row.supplier_name,
  },
  {
    key: "qty_in",
    title: "Qty In",
    align: "center",
    width: "9%",
    getValue: (row) => row.qty_in,
  },
  {
    key: "current_qty",
    title: "Current Qty",
    align: "center",
    width: "13%",
    getValue: (row) => Number(row.current_qty ?? row.qty_in ?? 0),
  },
  {
    key: "stock_in_time",
    title: "Date In",
    width: "14%",
    getValue: (row) => formatDateTime(row.stock_in_time),
  },
  {
    key: "expired_date",
    title: "Expired Date",
    width: "12%",
    getValue: (row) => formatDateOnly(row.expired_date),
  },
];

export const buildBatchTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildBatchDetailReportPdfFileName = (
  batch: Pick<BatchReportRow, "batch_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: batch.batch_code,
    date,
  });

export const buildBatchTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: BatchReportOptions) =>
  buildReportTablePrintHtml({
    title: "Batch Report",
    subtitle: "Inventory batch ledger",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: batchTableColumns,
    emptyText: "No batch data found.",
  });

export const buildBatchDetailReportPrintHtml = ({
  batch,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: BatchDetailReportOptions) => {
  const purchasePrice = Number(batch.purchase_price || 0);
  const quantity = Number(batch.qty_in || 0);
  const currentQuantity = Number(batch.current_qty ?? batch.qty_in ?? 0);

  return buildReportDetailPrintHtml({
    title: "Batch Detail",
    subtitle: "Inventory batch ledger",
    reportKey: REPORT_KEY,
    documentNumber: batch.batch_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Batch Information",
        fields: [
          { label: "Batch Code", value: batch.batch_code },
          { label: "Product Name", value: batch.product_name },
          { label: "Date In", value: formatDateTime(batch.stock_in_time) },
          { label: "Expired Date", value: formatDateOnly(batch.expired_date) },
          { label: "Buy / Pcs", value: formatRupiah(purchasePrice) },
          { label: "Qty In", value: quantity },
          { label: "Current Qty", value: currentQuantity },
          { label: "Total Buy", value: formatRupiah(purchasePrice * quantity) },
        ],
      },
    ],
  });
};
