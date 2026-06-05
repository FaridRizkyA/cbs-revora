import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportNestedTable,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type StockOutReportRow = {
  id_stock_out?: string;
  stock_out_code: string;
  stock_out_type?: string | null;
  cashier_name?: string | null;
  operator_name?: string | null;
  product_names?: string[];
  stock_out_date: string | Date;
  notes?: string | null;
  item_count: number;
  total_qty: number;
  total_buy?: number | null;
  total_sell?: number | null;
  total_profit?: number | null;
};

export type StockOutReportItemRow = {
  id_stock_movement?: string;
  product_code: string;
  product_name: string;
  batch_code?: string | null;
  quantity: number;
  buy_per_pcs?: number | null;
  sell_per_pcs?: number | null;
  total_buy?: number | null;
  total_sell?: number | null;
  profit?: number | null;
};

export type StockOutDetailReportRow = Omit<
  StockOutReportRow,
  "product_names" | "item_count"
> & {
  items: StockOutReportItemRow[];
};

export type StockOutReportOptions = {
  rows: StockOutReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type StockOutDetailReportOptions = {
  document: StockOutDetailReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const REPORT_KEY = "inventory-stock-out";

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

const displayStockOutType = (value?: string | null) => String(value || "SALE").replaceAll("_", " ");

const normalizeStockOutType = (value?: string | null) => String(value || "SALE").toUpperCase();

const isSaleType = (value?: string | null) => normalizeStockOutType(value) === "SALE";

const isRefundType = (value?: string | null) =>
  normalizeStockOutType(value) === "RETURN_TO_SUPPLIER_REFUND";

const lineBuyTotal = (item: StockOutReportItemRow) =>
  Number(item.total_buy ?? Number(item.buy_per_pcs || 0) * Number(item.quantity || 0));

const lineSellTotal = (item: StockOutReportItemRow) =>
  Number(item.total_sell ?? Number(item.sell_per_pcs || 0) * Number(item.quantity || 0));

const calculateTotalBuy = (document: StockOutDetailReportRow) =>
  Number(document.total_buy ?? document.items.reduce((sum, item) => sum + lineBuyTotal(item), 0));

const calculateTotalSell = (document: StockOutDetailReportRow) =>
  Number(document.total_sell ?? document.items.reduce((sum, item) => sum + lineSellTotal(item), 0));

const calculateProfit = (document: StockOutDetailReportRow) =>
  Number(document.total_profit ?? document.items.reduce((sum, item) => sum + Number(item.profit || 0), 0));

const getActorName = (row: Pick<StockOutReportRow, "cashier_name" | "operator_name" | "stock_out_type">) =>
  isSaleType(row.stock_out_type) ? row.cashier_name : row.operator_name;

const stockOutTableColumns: ReportTableColumn<StockOutReportRow>[] = [
  {
    key: "row_number",
    title: "No.",
    align: "center",
    width: "36px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "stock_out_code",
    title: "Stock Out Code",
    width: "17%",
    getValue: (row) => row.stock_out_code,
  },
  {
    key: "stock_out_type",
    title: "Type",
    width: "13%",
    getValue: (row) => displayStockOutType(row.stock_out_type),
  },
  {
    key: "actor",
    title: "Cashier / Operator",
    width: "16%",
    getValue: (row) => getActorName(row),
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
    title: "Qty",
    align: "center",
    width: "8%",
    getValue: (row) => row.total_qty,
  },
  {
    key: "total_sell",
    title: "Total Sell",
    align: "right",
    width: "15%",
    getValue: (row) => {
      if (isSaleType(row.stock_out_type)) return formatRupiah(Number(row.total_sell || 0));
      if (isRefundType(row.stock_out_type)) return formatRupiah(Number(row.total_buy || 0));
      return formatRupiah(0);
    },
  },
  {
    key: "profit",
    title: "Profit",
    align: "right",
    width: "13%",
    getValue: (row) => {
      if (isSaleType(row.stock_out_type)) return formatRupiah(Number(row.total_profit || 0));
      if (isRefundType(row.stock_out_type)) return formatRupiah(0);
      return formatRupiah(Number(row.total_profit ?? -Number(row.total_buy || 0)));
    },
  },
  {
    key: "stock_out_date",
    title: "Date",
    width: "15%",
    getValue: (row) => formatDateTime(row.stock_out_date),
  },
];

export const buildStockOutTableReportPdfFileName = (date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "table",
    date,
  });

export const buildStockOutDetailReportPdfFileName = (
  document: Pick<StockOutDetailReportRow, "stock_out_code">,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: REPORT_KEY,
    variant: "detail",
    documentNumber: document.stock_out_code,
    date,
  });

export const buildStockOutTableReportPrintHtml = ({
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockOutReportOptions) =>
  buildReportTablePrintHtml({
    title: "Stock Out Report",
    subtitle: "Inventory stock out documents",
    reportKey: REPORT_KEY,
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: stockOutTableColumns,
    emptyText: "No stock out data found.",
  });

const buildSaleItemsTable = (document: StockOutDetailReportRow): ReportNestedTable => ({
  title: "Stock Out Items",
  emptyText: "No stock out items.",
  columns: [
    { key: "row_number", title: "No.", align: "center", width: "42px" },
    { key: "product_code", title: "Product Code", width: "14%" },
    { key: "product_name", title: "Product" },
    { key: "batch_code", title: "Batch", width: "14%" },
    { key: "quantity", title: "Qty", align: "center", width: "8%" },
    { key: "buy_per_pcs", title: "Buy / Pcs", align: "right", width: "13%" },
    { key: "sell_per_pcs", title: "Sell / Pcs", align: "right", width: "13%" },
    { key: "profit_per_pcs", title: "Profit / Pcs", align: "right", width: "13%" },
    { key: "profit", title: "Profit", align: "right", width: "13%" },
  ],
  rows: document.items.map((item, index) => {
    const buyPerPcs = Number(item.buy_per_pcs || 0);
    const sellPerPcs = Number(item.sell_per_pcs || 0);

    return {
      row_number: index + 1,
      product_code: item.product_code,
      product_name: item.product_name,
      batch_code: item.batch_code,
      quantity: item.quantity,
      buy_per_pcs: formatRupiah(buyPerPcs),
      sell_per_pcs: formatRupiah(sellPerPcs),
      profit_per_pcs: formatRupiah(sellPerPcs - buyPerPcs),
      profit: formatRupiah(Number(item.profit || (sellPerPcs - buyPerPcs) * Number(item.quantity || 0))),
    };
  }),
});

const buildNonSaleItemsTable = (document: StockOutDetailReportRow): ReportNestedTable => {
  const isRefund = isRefundType(document.stock_out_type);

  return {
    title: "Stock Out Items",
    emptyText: "No stock out items.",
    columns: [
      { key: "row_number", title: "No.", align: "center", width: "42px" },
      { key: "product_code", title: "Product Code", width: "16%" },
      { key: "product_name", title: "Product" },
      { key: "batch_code", title: "Batch", width: "16%" },
      { key: "quantity", title: "Qty", align: "center", width: "9%" },
      { key: "buy_per_pcs", title: "Buy / Pcs", align: "right", width: "16%" },
      {
        key: isRefund ? "total_refund" : "total_loss",
        title: isRefund ? "Total Refund" : "Total Loss",
        align: "right",
        width: "17%",
      },
    ],
    rows: document.items.map((item, index) => {
      const totalBuy = lineBuyTotal(item);

      return {
        row_number: index + 1,
        product_code: item.product_code,
        product_name: item.product_name,
        batch_code: item.batch_code,
        quantity: item.quantity,
        buy_per_pcs: formatRupiah(Number(item.buy_per_pcs || 0)),
        total_refund: formatRupiah(totalBuy),
        total_loss: formatRupiah(totalBuy),
      };
    }),
  };
};

export const buildStockOutDetailReportPrintHtml = ({
  document,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: StockOutDetailReportOptions) => {
  const type = normalizeStockOutType(document.stock_out_type);
  const isSale = type === "SALE";
  const isRefund = isRefundType(type);
  const totalQty = document.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalBuy = calculateTotalBuy(document);
  const totalSell = calculateTotalSell(document);
  const profit = calculateProfit(document);

  return buildReportDetailPrintHtml({
    title: "Stock Out Detail",
    subtitle: "Inventory stock out document",
    reportKey: REPORT_KEY,
    documentNumber: document.stock_out_code,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Stock Out Information",
        fields: [
          { label: "Stock Out Code", value: document.stock_out_code },
          { label: "Type", value: displayStockOutType(document.stock_out_type) },
          { label: isSale ? "Cashier" : "Operator", value: getActorName(document) },
          { label: "Date", value: formatDateTime(document.stock_out_date) },
          { label: "Item Count", value: document.items.length },
          { label: "Total Qty", value: totalQty },
          ...(isSale
            ? [
                { label: "Total Buy", value: formatRupiah(totalBuy) },
                { label: "Total Sell", value: formatRupiah(totalSell) },
                { label: "Profit", value: formatRupiah(profit) },
              ]
            : [
                { label: "Financial Impact", value: isRefund ? "Refund / No Loss" : "Loss" },
                { label: isRefund ? "Total Refund" : "Total Loss", value: formatRupiah(totalBuy) },
                ...(isRefund ? [{ label: "Profit", value: formatRupiah(0) }] : []),
              ]),
          { label: "Notes", value: document.notes },
        ],
      },
    ],
    tables: [isSale ? buildSaleItemsTable(document) : buildNonSaleItemsTable(document)],
  });
};
