import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type StockAdjustmentReportRow = {
  id_stock_movement?: string;
  adjustment_code?: string | null;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  buy_per_pcs?: number | null;
  total_loss?: number | null;
  adjustment_type: "INCREASE" | "DECREASE" | "ADJUSTMENT" | string;
  adjustment_reason?: string | null;
  quantity: number;
  reason?: string | null;
  notes?: string | null;
  movement_date: string | Date;
  operator_name?: string | null;
};

export type StockAdjustmentReportOptions = {
  rows: StockAdjustmentReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type StockAdjustmentDetailReportOptions = {
  adjustment: StockAdjustmentReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-stock-adjustment";

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

const displayText = (value?: string | null) => String(value || "-").replaceAll("_", " ");

const normalizeReason = (row: Pick<StockAdjustmentReportRow, "adjustment_reason" | "reason">) =>
  displayText(
    String(row.adjustment_reason || row.reason || "")
      .replace("ADJUSTMENT_INCREASE:", "")
      .replace("ADJUSTMENT_DECREASE:", "")
      .replace("ADJUSTMENT:", "")
  );

const stockAdjustmentTableColumns: ReportTableColumn<StockAdjustmentReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "adjustment_code",
    title: "Adjustment Code",
    width: "18%",
    getValue: (row) => row.adjustment_code,
  },
  {
    key: "product_name",
    title: "Product",
    getValue: (row) => row.product_name,
  },
  {
    key: "batch_code",
    title: "Batch",
    width: "14%",
    getValue: (row) => row.batch_code,
  },
  {
    key: "adjustment_type",
    title: "Type",
    width: "11%",
    getValue: (row) => row.adjustment_type,
  },
  {
    key: "quantity",
    title: "Qty",
    align: "center",
    width: "8%",
    getValue: (row) => row.quantity,
  },
  {
    key: "operator_name",
    title: "Operator",
    width: "14%",
    getValue: (row) => row.operator_name,
  },
  {
    key: "movement_date",
    title: "Date",
    width: "15%",
    getValue: (row) => formatDateTime(row.movement_date),
  },
];

export const buildStockAdjustmentTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildStockAdjustmentDetailReportPdfFileName = (
  adjustment: Pick<StockAdjustmentReportRow, "adjustment_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: adjustment.adjustment_code,
    date,
  });

export const buildStockAdjustmentTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockAdjustmentReportOptions) =>
  buildReportTablePrintHtml({
    title: "Stock Adjustment Report",
    subtitle: "Inventory stock correction journal",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: stockAdjustmentTableColumns,
    emptyText: "No stock adjustment data found.",
  });

export const buildStockAdjustmentDetailReportPrintHtml = ({
  adjustment,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockAdjustmentDetailReportOptions) =>
  buildReportDetailPrintHtml({
    title: "Stock Adjustment Detail",
    subtitle: "Inventory stock correction journal entry",
    reportKey: REPORT_KEY,
    documentNumber: adjustment.adjustment_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Adjustment Information",
        fields: [
          { label: "Adjustment Code", value: adjustment.adjustment_code },
          { label: "Product Code", value: adjustment.product_code },
          { label: "Product", value: adjustment.product_name },
          { label: "Batch", value: adjustment.batch_code },
          { label: "Type", value: adjustment.adjustment_type },
          { label: "Qty", value: adjustment.quantity },
          { label: "Buy / Pcs", value: formatRupiah(Number(adjustment.buy_per_pcs || 0)) },
          { label: "Total Loss", value: formatRupiah(Number(adjustment.total_loss || 0)) },
          { label: "Reason", value: normalizeReason(adjustment) },
          { label: "Operator", value: adjustment.operator_name },
          { label: "Date", value: formatDateTime(adjustment.movement_date) },
          { label: "Notes", value: adjustment.notes },
        ],
      },
    ],
  });
