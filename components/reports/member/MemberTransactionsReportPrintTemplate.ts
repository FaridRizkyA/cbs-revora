import { formatDateTime, formatRupiah } from "../../shu/formatters";

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

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDateTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return formatDateTime(date.toISOString());
};

export const buildMemberTransactionsReportPrintHtml = ({
  memberName,
  memberCode,
  rangeLabel,
  generatedAt,
  rows,
}: {
  memberName: string;
  memberCode: string;
  rangeLabel: string;
  generatedAt: Date;
  rows: MemberTransactionReportRow[];
}) => {
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalItems = rows.reduce((sum, row) => sum + Number(row.item_count || row.items?.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0) || 0), 0);

  const bodyRows = rows
    .map((row, index) => {
      const mainRow = `
        <tr class="main-row">
          <td>${index + 1}</td>
          <td>${escapeHtml(row.sale_number)}</td>
          <td>${escapeHtml(formatDateTime(row.sale_date))}</td>
          <td>${escapeHtml(row.payment_method || "-")}</td>
          <td>${escapeHtml(row.cashier_name || "-")}</td>
          <td class="right">${escapeHtml(String(row.item_count ?? row.items?.length ?? 0))}</td>
          <td class="right">${escapeHtml(formatRupiah(Number(row.total_amount || 0)))}</td>
        </tr>
      `;

      if (!row.items || row.items.length === 0) return mainRow;

      const itemRows = row.items
        .map(
          (item) => `
        <tr class="item-row">
          <td colspan="2"></td>
          <td colspan="3" class="item-name">${escapeHtml(item.product_name)} <span class="item-meta">(${escapeHtml(item.product_code)})</span></td>
          <td class="right">${escapeHtml(String(item.quantity))}</td>
          <td class="right">${escapeHtml(formatRupiah(Number(item.subtotal || 0)))}</td>
        </tr>
      `
        )
        .join("");

      return mainRow + itemRows;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Member Spending Detail</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }
      .page {
        padding: 20px 22px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 14px;
      }
      .title {
        font-size: 20px;
        font-weight: 800;
        margin: 0 0 4px 0;
      }
      .subtitle {
        margin: 0;
        color: #475569;
      }
      .meta {
        min-width: 220px;
        text-align: right;
        color: #334155;
      }
      .pill {
        display: inline-block;
        margin-top: 4px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 700;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 0 18px;
      }
      .summary-box {
        border: 1px solid #dbe3ee;
        border-radius: 10px;
        padding: 10px 12px;
        background: #f8fafc;
      }
      .summary-label {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 4px;
      }
      .summary-value {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #dbe3ee;
        padding: 8px 10px;
        vertical-align: top;
      }
      .main-row td {
        font-weight: 700;
        background: #fcfdfe;
      }
      .item-row td {
        padding: 6px 10px;
        color: #475569;
        font-size: 11px;
        border-top: none;
      }
      .item-name {
        font-style: italic;
      }
      .item-meta {
        font-size: 10px;
        color: #94a3b8;
      }
      th {
        background: #eaf0f7;
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      td.right, th.right {
        text-align: right;
      }
      .footer {
        margin-top: 12px;
        color: #475569;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 11px;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="header">
        <div>
          <h1 class="title">Spending Detail Report</h1>
          <p class="subtitle">${escapeHtml(memberName)}${memberCode ? ` (${escapeHtml(memberCode)})` : ""}</p>
          <span class="pill">${escapeHtml(rangeLabel)}</span>
        </div>
        <div class="meta">
          <div>Generated at: ${escapeHtml(formatDateTimeValue(generatedAt))}</div>
          <div>Rows: ${escapeHtml(rows.length)}</div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-box">
          <div class="summary-label">Total Transactions</div>
          <div class="summary-value">${escapeHtml(String(rows.length))}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Items</div>
          <div class="summary-value">${escapeHtml(String(totalItems))}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Spending</div>
          <div class="summary-value">${escapeHtml(formatRupiah(totalAmount))}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 42px;">No</th>
            <th>Transaction No.</th>
            <th>Date</th>
            <th>Payment</th>
            <th>Cashier</th>
            <th class="right" style="width: 70px;">Items</th>
            <th class="right" style="width: 130px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows || '<tr><td colspan="7" style="text-align:center;color:#64748b;">No transactions found.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>Member spending detail generated from CBS Revora.</div>
        <div>Total amount: ${escapeHtml(formatRupiah(totalAmount))}</div>
      </div>
    </main>
  </body>
</html>`;
};
