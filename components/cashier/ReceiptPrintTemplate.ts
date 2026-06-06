import { buildExportFileName } from "../../utils/exportFileName";

export type ReceiptPaymentMethod = "CASH" | "QRIS";

export type ReceiptStoreInfo = {
  name?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
};

export type ReceiptItem = {
  productCode?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
};

export type ReceiptMemberInfo = {
  code?: string | null;
  name?: string | null;
};

export type ReceiptData = {
  saleNumber: string;
  saleDate: string | Date;
  cashierName: string;
  member?: ReceiptMemberInfo | null;
  paymentMethod: ReceiptPaymentMethod;
  amountPaid: number;
  changeAmount: number;
  discountAmount?: number;
  notes?: string | null;
  items: ReceiptItem[];
};

const DEFAULT_STORE_INFO: ReceiptStoreInfo = {
  name: "CBS Revora",
  subtitle: "Koperasi Jasa Cahaya Berkah Sejahtera",
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");

const formatReceiptDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
};

const buildCompactProductLabelFromName = (productName: string) => {
  const tokens = String(productName || "")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  const compactTokens = tokens
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .map((token) => {
      if (!token) return "";
      const first = token[0];
      const rest = token.slice(1).replace(/[AEIOU]/g, "");
      return /[AEIOU]/.test(first) ? `${first}${rest}` : token.replace(/[AEIOU]/g, "");
    })
    .filter(Boolean);

  return compactTokens.join(" ");
};

export const formatReceiptProductLabel = (item: Pick<ReceiptItem, "productCode" | "productName">) => {
  const fromName = buildCompactProductLabelFromName(item.productName);
  if (fromName) return fromName;

  const code = String(item.productCode || "")
    .replace(/^PRD[-_\s]*/i, "")
    .replace(/-/g, " ")
    .trim();

  return code ? code.toUpperCase() : item.productName;
};

export const buildReceiptPdfFileName = (data: Pick<ReceiptData, "saleNumber" | "saleDate">) =>
  buildExportFileName({
    prefix: "receipt",
    documentNumber: data.saleNumber,
    date: data.saleDate,
    extension: "pdf",
  });

export const buildReceiptPrintHtml = (data: ReceiptData, storeInfo: ReceiptStoreInfo = {}) => {
  const store = { ...DEFAULT_STORE_INFO, ...storeInfo };
  const printTitle = buildReceiptPdfFileName(data).replace(/\.pdf$/i, "");
  const subtotal = data.items.reduce(
    (total, item) => total + (item.lineTotal ?? item.quantity * item.unitPrice),
    0
  );
  const discount = Number(data.discountAmount || 0);
  const total = Math.max(subtotal - discount, 0);
  const memberLabel = data.member?.name || "-";

  const itemRows = data.items
    .map((item) => {
      const quantity = Math.max(Number(item.quantity || 0), 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.lineTotal ?? quantity * unitPrice);

      return `
        <div class="item">
          <div class="item-name">${escapeHtml(formatReceiptProductLabel(item))}</div>
          <div class="item-meta">
            <span>${quantity} x ${escapeHtml(formatRupiah(unitPrice))}</span>
            <span>${escapeHtml(formatRupiah(lineTotal))}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(printTitle)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #ffffff;
        color: #111827;
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1.35;
      }

      .receipt {
        width: 80mm;
        margin: 0 auto;
        padding: 12px 10px;
      }

      .center {
        text-align: center;
      }

      .store-name {
        font-size: 16px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .store-subtitle,
      .store-detail,
      .muted {
        color: #374151;
      }

      .divider {
        border-top: 1px dashed #111827;
        margin: 9px 0;
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .row span:first-child {
        flex: 0 0 auto;
      }

      .row span:last-child {
        min-width: 0;
        text-align: right;
        word-break: break-word;
      }

      .item {
        margin-bottom: 8px;
      }

      .item-name {
        font-weight: 700;
        word-break: break-word;
      }

      .item-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: #111827;
      }

      .summary .row {
        margin-bottom: 4px;
      }

      .total {
        font-size: 14px;
        font-weight: 700;
      }

      .footer {
        margin-top: 10px;
        text-align: center;
      }

      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }

        body {
          width: 80mm;
        }

        .receipt {
          width: 80mm;
          margin: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="center">
        <div class="store-name">${escapeHtml(store.name)}</div>
        ${store.subtitle ? `<div class="store-subtitle">${escapeHtml(store.subtitle)}</div>` : ""}
        ${store.address ? `<div class="store-detail">${escapeHtml(store.address)}</div>` : ""}
        ${store.phone ? `<div class="store-detail">Phone: ${escapeHtml(store.phone)}</div>` : ""}
      </header>

      <div class="divider"></div>

      <section>
        <div class="row"><span>Receipt</span><span>${escapeHtml(data.saleNumber)}</span></div>
        <div class="row"><span>Date</span><span>${escapeHtml(formatReceiptDateTime(data.saleDate))}</span></div>
        <div class="row"><span>Cashier</span><span>${escapeHtml(data.cashierName)}</span></div>
        <div class="row"><span>Member</span><span>${escapeHtml(memberLabel)}</span></div>
      </section>

      <div class="divider"></div>

      <section>
        ${itemRows || '<div class="muted center">No items</div>'}
      </section>

      <div class="divider"></div>

      <section class="summary">
        <div class="row"><span>Subtotal</span><span>${escapeHtml(formatRupiah(subtotal))}</span></div>
        <div class="row total"><span>Total</span><span>${escapeHtml(formatRupiah(total))}</span></div>
        <div class="row"><span>Payment</span><span>${escapeHtml(data.paymentMethod)}</span></div>
        <div class="row"><span>Paid</span><span>${escapeHtml(formatRupiah(data.amountPaid))}</span></div>
        <div class="row"><span>Change</span><span>${escapeHtml(formatRupiah(data.changeAmount))}</span></div>
      </section>

      ${data.notes ? `<div class="divider"></div><section><div class="muted">${escapeHtml(data.notes)}</div></section>` : ""}

      <div class="divider"></div>

      <footer class="footer">
        <div>Thank you for shopping.</div>
        <div class="muted">CBS Revora</div>
      </footer>
    </main>
  </body>
</html>`;
};
