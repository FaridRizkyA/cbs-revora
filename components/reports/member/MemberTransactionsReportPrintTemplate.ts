import { formatDateTime, formatRupiah } from "../../shu/formatters";
import {
  buildReportTablePrintHtml,
  downloadReportTableExcel,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

type MemberTransactionItem = {
  product_code?: string | null;
  product_name?: string | null;
  quantity?: number;
  unit_price?: number;
  subtotal?: number;
};

export type MemberTransactionReportRow = {
  id_sale: string;
  sale_number: string;
  sale_date: string;
  payment_method: string;
  cashier_name?: string | null;
  subtotal?: number;
  discount_amount?: number;
  total_amount?: number;
  amount_paid?: number;
  change_amount?: number;
  notes?: string | null;
  item_count?: number;
  items?: MemberTransactionItem[];
};

export type MemberTransactionItemFlatRow = MemberTransactionItem & {
  sale_date: string;
  sale_number: string;
  payment_method: string;
};

const REPORT_KEY = "member-transactions";

export const memberTransactionTableColumns: ReportTableColumn<MemberTransactionReportRow>[] = [
  {
    key: "no",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "sale_number",
    title: "Transaction No.",
    width: "20%",
    getValue: (row) => row.sale_number,
  },
  {
    key: "sale_date",
    title: "Date",
    width: "18%",
    getValue: (row) => formatDateTime(row.sale_date),
  },
  {
    key: "payment_method",
    title: "Payment",
    align: "center",
    width: "12%",
    getValue: (row) => row.payment_method,
  },
  {
    key: "cashier",
    title: "Cashier",
    width: "18%",
    getValue: (row) => row.cashier_name || "-",
  },
  {
    key: "item_count",
    title: "Items",
    align: "right",
    width: "10%",
    getValue: (row) => row.item_count ?? row.items?.length ?? 0,
  },
  {
    key: "total_amount",
    title: "Total Spending",
    align: "right",
    width: "15%",
    getValue: (row) => formatRupiah(Number(row.total_amount || 0)),
  },
];

export const memberTransactionItemTableColumns: ReportTableColumn<MemberTransactionItemFlatRow>[] = [
  {
    key: "no",
    title: "No.",
    align: "center",
    width: "42px",
    getValue: (_row, index) => index + 1,
  },
  {
    key: "sale_number",
    title: "Transaction No.",
    width: "18%",
    getValue: (row) => row.sale_number,
  },
  {
    key: "sale_date",
    title: "Date",
    width: "16%",
    getValue: (row) => formatDateTime(row.sale_date),
  },
  {
    key: "product_name",
    title: "Product",
    width: "30%",
    getValue: (row) => `${row.product_name} (${row.product_code})`,
  },
  {
    key: "quantity",
    title: "Qty",
    align: "right",
    width: "8%",
    getValue: (row) => row.quantity,
  },
  {
    key: "unit_price",
    title: "Unit Price",
    align: "right",
    width: "13%",
    getValue: (row) => formatRupiah(Number(row.unit_price || 0)),
  },
  {
    key: "subtotal",
    title: "Subtotal",
    align: "right",
    width: "15%",
    getValue: (row) => formatRupiah(Number(row.subtotal || 0)),
  },
];

export const buildMemberTransactionsTableReportPrintHtml = ({
  rows,
  viewMode,
  memberName,
  rangeLabel,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: {
  rows: any[];
  viewMode: "TRANSACTION" | "ITEM";
  memberName: string;
  rangeLabel: string;
  generatedAt?: Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
}) => {
  const totalTransactions = viewMode === "TRANSACTION" ? rows.length : new Set(rows.map(r => r.sale_number)).size;
  const totalItems = viewMode === "ITEM" ? rows.length : rows.reduce((sum, r) => sum + (r.item_count ?? r.items?.length ?? 0), 0);
  const totalSpending = rows.reduce((sum, r) => sum + Number(viewMode === "TRANSACTION" ? r.total_amount : r.subtotal), 0);

  return buildReportTablePrintHtml({
    title: "Member Spending History",
    subtitle: `${memberName} - ${rangeLabel}`,
    reportKey: `${REPORT_KEY}-${viewMode.toLowerCase()}`,
    generatedAt,
    generatedBy,
    meta: [
      { label: "View Mode", value: viewMode === "TRANSACTION" ? "Per Transaction" : "Per Item" },
      { label: "Total Transactions", value: String(totalTransactions) },
      { label: "Total Items", value: String(totalItems) },
      { label: "Total Spending", value: formatRupiah(totalSpending) },
      ...meta,
    ],
    rows,
    columns:
      viewMode === "TRANSACTION"
        ? (memberTransactionTableColumns as any)
        : (memberTransactionItemTableColumns as any),
    emptyText: "No spending data found.",
  });
};

export const downloadMemberTransactionsTableReportExcel = ({
  rows,
  viewMode,
  memberName,
  rangeLabel,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: {
  rows: any[];
  viewMode: "TRANSACTION" | "ITEM";
  memberName: string;
  rangeLabel: string;
  generatedAt?: Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
}) => {
  const totalTransactions = viewMode === "TRANSACTION" ? rows.length : new Set(rows.map(r => r.sale_number)).size;
  const totalItems = viewMode === "ITEM" ? rows.length : rows.reduce((sum, r) => sum + (r.item_count ?? r.items?.length ?? 0), 0);
  const totalSpending = rows.reduce((sum, r) => sum + Number(viewMode === "TRANSACTION" ? r.total_amount : r.subtotal), 0);

  return downloadReportTableExcel({
    title: "Member Spending History",
    subtitle: `${memberName} - ${rangeLabel}`,
    reportKey: `${REPORT_KEY}-${viewMode.toLowerCase()}`,
    generatedAt,
    generatedBy,
    meta: [
      { label: "View Mode", value: viewMode === "TRANSACTION" ? "Per Transaction" : "Per Item" },
      { label: "Total Transactions", value: String(totalTransactions) },
      { label: "Total Items", value: String(totalItems) },
      { label: "Total Spending", value: formatRupiah(totalSpending) },
      ...meta,
    ],
    rows,
    columns:
      viewMode === "TRANSACTION"
        ? (memberTransactionTableColumns as any)
        : (memberTransactionItemTableColumns as any),
    emptyText: "No spending data found.",
  });
};

