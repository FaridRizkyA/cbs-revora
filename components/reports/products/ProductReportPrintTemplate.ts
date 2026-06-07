import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type ProductReportRow = {
  id_product?: string;
  is_active?: string | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  product_code: string;
  barcode?: string | null;
  product_name: string;
  description?: string | null;
  selling_price: number;
  minimum_stock: number;
  available_stock: number;
};

export type ProductBatchReportRow = {
  id_product_batch?: string;
  batch_code: string;
  expired_date?: string | Date | null;
  batch_qty: number;
};

export type ProductReportOptions = {
  rows: ProductReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type ProductDetailReportOptions = {
  product: ProductReportRow;
  batches?: ProductBatchReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-products";

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

const getProductStatusLabel = (value?: string | null) => (value === "N" ? "Inactive" : "Active");

const getStockStatusLabel = (product: Pick<ProductReportRow, "available_stock" | "minimum_stock">) => {
  const available = Number(product.available_stock || 0);
  const minimum = Number(product.minimum_stock || 0);
  if (available <= 0) return "Out of Stock";
  if (available <= minimum) return "Low Stock";
  return "Safe Stock";
};

export const productTableColumns: ReportTableColumn<ProductReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "48px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "product_code",
    title: "Product Code",
    width: "16%",
    getValue: (row) => row.product_code,
  },
  {
    key: "product_name",
    title: "Product Name",
    getValue: (row) => row.product_name,
  },
  {
    key: "barcode",
    title: "Barcode",
    width: "16%",
    getValue: (row) => row.barcode,
  },
  {
    key: "supplier_name",
    title: "Supplier",
    width: "20%",
    getValue: (row) => row.supplier_name,
  },
  {
    key: "selling_price",
    title: "Price",
    align: "right",
    width: "14%",
    getValue: (row) => formatRupiah(row.selling_price),
  },
  {
    key: "available_stock",
    title: "Stock",
    align: "center",
    width: "10%",
    getValue: (row) => row.available_stock,
  },
];

export const buildProductTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildProductDetailReportPdfFileName = (
  product: Pick<ProductReportRow, "product_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: product.product_code,
    date,
  });

export const buildProductTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ProductReportOptions) =>
  buildReportTablePrintHtml({
    title: "Product Report",
    subtitle: "Inventory product master data",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: productTableColumns,
    emptyText: "No product data found.",
  });

export const downloadProductTableReportExcel = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ProductReportOptions) =>
  downloadReportTableExcel({
    title: "Product Report",
    subtitle: "Inventory product master data",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: productTableColumns,
    emptyText: "No product data found.",
  });

export const buildProductDetailReportPrintHtml = ({
  product,
  batches = [],
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: ProductDetailReportOptions) =>
  buildReportDetailPrintHtml({
    title: "Product Detail",
    subtitle: "Inventory product master data",
    reportKey: REPORT_KEY,
    documentNumber: product.product_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Product Information",
        fields: [
          { label: "Product Code", value: product.product_code },
          { label: "Product Name", value: product.product_name },
          { label: "Supplier", value: product.supplier_name },
          { label: "Supplier Code", value: product.supplier_code },
          { label: "Status", value: getProductStatusLabel(product.is_active) },
          { label: "Barcode", value: product.barcode },
          { label: "Selling Price", value: formatRupiah(product.selling_price) },
          { label: "Available Stock", value: product.available_stock },
          { label: "Minimum Stock", value: product.minimum_stock },
          { label: "Stock Status", value: getStockStatusLabel(product) },
          { label: "Description", value: product.description },
        ],
      },
    ],
    tables: [
      {
        title: "Batch Summary",
        emptyText: "No batch data for this product.",
        columns: [
          { key: "row_number", title: "No.", align: "center", width: "48px" },
          { key: "batch_code", title: "Batch Code" },
          { key: "batch_qty", title: "Qty", align: "center", width: "18%" },
          { key: "expired_date", title: "Expired Date", width: "24%" },
        ],
        rows: batches.map((batch, index) => ({
          row_number: index + 1,
          batch_code: batch.batch_code,
          batch_qty: batch.batch_qty,
          expired_date: formatDateOnly(batch.expired_date),
        })),
      },
    ],
  });
