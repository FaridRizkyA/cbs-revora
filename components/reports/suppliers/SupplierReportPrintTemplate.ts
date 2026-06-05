import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type SupplierReportRow = {
  id_supplier?: string;
  supplier_code: string;
  supplier_name: string;
  city?: string | null;
  phone_number?: string | null;
  is_active?: string | null;
};

export type SupplierReportProductRow = {
  id_product?: string;
  product_code: string;
  product_name: string;
  barcode?: string | null;
};

export type SupplierReportOptions = {
  rows: SupplierReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type SupplierDetailReportOptions = {
  supplier: SupplierReportRow;
  products?: SupplierReportProductRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-suppliers";

const getSupplierStatusLabel = (value?: string | null) => (value === "Y" ? "Active" : "Inactive");

const supplierTableColumns: ReportTableColumn<SupplierReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "48px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "supplier_code",
    title: "Supplier Code",
    width: "18%",
    getValue: (row) => row.supplier_code,
  },
  {
    key: "supplier_name",
    title: "Supplier Name",
    getValue: (row) => row.supplier_name,
  },
  {
    key: "city",
    title: "City",
    width: "18%",
    getValue: (row) => row.city,
  },
  {
    key: "phone_number",
    title: "Phone",
    width: "18%",
    getValue: (row) => row.phone_number,
  },
];

export const buildSupplierTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildSupplierDetailReportPdfFileName = (
  supplier: Pick<SupplierReportRow, "supplier_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: supplier.supplier_code,
    date,
  });

export const buildSupplierTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SupplierReportOptions) =>
  buildReportTablePrintHtml({
    title: "Supplier Report",
    subtitle: "Inventory supplier master data",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: supplierTableColumns,
    emptyText: "No supplier data found.",
  });

export const buildSupplierDetailReportPrintHtml = ({
  supplier,
  products = [],
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: SupplierDetailReportOptions) =>
  buildReportDetailPrintHtml({
    title: "Supplier Detail",
    subtitle: "Inventory supplier master data",
    reportKey: REPORT_KEY,
    documentNumber: supplier.supplier_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Supplier Information",
        fields: [
          { label: "Supplier Code", value: supplier.supplier_code },
          { label: "Supplier Name", value: supplier.supplier_name },
          { label: "City", value: supplier.city },
          { label: "Phone", value: supplier.phone_number },
          { label: "Status", value: getSupplierStatusLabel(supplier.is_active) },
        ],
      },
    ],
    tables: [
      {
        title: "Linked Products",
        emptyText: "No linked products.",
        columns: [
          { key: "row_number", title: "No.", align: "center", width: "48px" },
          { key: "product_code", title: "Product Code", width: "22%" },
          { key: "product_name", title: "Product Name" },
          { key: "barcode", title: "Barcode", width: "24%" },
        ],
        rows: products.map((product, index) => ({
          row_number: index + 1,
          product_code: product.product_code,
          product_name: product.product_name,
          barcode: product.barcode,
        })),
      },
    ],
  });
