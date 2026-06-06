const { chromium } = require("playwright");
const path = require("path");
const { sendEmail } = require("./mailer");
const { renderTemplate } = require("./templateRenderer");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");

const formatReceiptDateTime = (value) => {
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

const buildCompactProductLabelFromName = (productName) => {
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

const formatReceiptProductLabel = (item) => {
  const fromName = buildCompactProductLabelFromName(item.productName);
  if (fromName) return fromName;

  const code = String(item.productCode || "")
    .replace(/^PRD[-_\s]*/i, "")
    .replace(/-/g, " ")
    .trim();

  return code ? code.toUpperCase() : item.productName;
};

const sanitizeAttachmentFileName = (value, fallback = "receipt.pdf") => {
  const safe = String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || fallback;
};

const buildReceiptEmailContent = (data) => {
  const subtotal = data.items.reduce(
    (total, item) => total + (item.lineTotal ?? item.quantity * item.unitPrice),
    0
  );
  const discount = Number(data.discountAmount || 0);
  const total = Math.max(subtotal - discount, 0);
  const itemRows = data.items
    .map((item) => {
      const quantity = Math.max(Number(item.quantity || 0), 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.lineTotal ?? quantity * unitPrice);

      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            <div style="font-weight: 700; color: #0f172a;">${escapeHtml(formatReceiptProductLabel(item))}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 2px;">${quantity} x ${escapeHtml(formatRupiah(unitPrice))}</div>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap; font-weight: 700; color: #0f172a;">
            ${escapeHtml(formatRupiah(lineTotal))}
          </td>
        </tr>
      `;
    })
    .join("");

  return renderTemplate("ReceiptEmail", {
    TITLE: "Receipt Attached",
    RECIPIENT_NAME: data.recipientName || "Member",
    SALE_NUMBER: data.saleNumber,
    SALE_DATE: formatReceiptDateTime(data.saleDate),
    CASHIER_NAME: data.cashierName,
    MEMBER_NAME: data.member?.name || "-",
    PAYMENT_METHOD: data.paymentMethod,
    SUBTOTAL: formatRupiah(subtotal),
    DISCOUNT: formatRupiah(discount),
    TOTAL: formatRupiah(total),
    AMOUNT_PAID: formatRupiah(data.amountPaid),
    CHANGE_AMOUNT: formatRupiah(data.changeAmount),
    NOTES_BLOCK: data.notes
      ? `
        <div style="margin-top: 18px;">
          <div style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">Notes</div>
          <div style="color: #334155; font-size: 14px; line-height: 1.6;">${escapeHtml(data.notes)}</div>
        </div>
      `
      : "",
    ITEM_ROWS: itemRows || `
      <tr>
        <td colspan="2" style="padding: 16px 12px; text-align: center; color: #64748b;">No items</td>
      </tr>
    `,
  });
};

const buildReceiptHtml = (data) => {
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
    <title>${escapeHtml(`receipt-${data.saleNumber}`)}</title>
    <style>
      * { box-sizing: border-box; }
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
      .center { text-align: center; }
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
      .row span:first-child { flex: 0 0 auto; }
      .row span:last-child {
        min-width: 0;
        text-align: right;
        word-break: break-word;
      }
      .item { margin-bottom: 8px; }
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
      .summary .row { margin-bottom: 4px; }
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
        body { width: 80mm; }
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
        <div class="store-name">CBS Revora</div>
        <div class="store-subtitle">Receipt</div>
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

const renderReceiptPdfBuffer = async (html) => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 420, height: 1400 },
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
};

const sendReceiptEmail = async ({
  to,
  saleNumber,
  saleDate,
  cashierName,
  member,
  paymentMethod,
  amountPaid,
  changeAmount,
  discountAmount = 0,
  notes = null,
  items,
}) => {
  const html = buildReceiptHtml({
    saleNumber,
    saleDate,
    cashierName,
    member,
    paymentMethod,
    amountPaid,
    changeAmount,
    discountAmount,
    notes,
    items,
  });
  const pdfBuffer = await renderReceiptPdfBuffer(html);
  const attachmentName = sanitizeAttachmentFileName(`receipt_${saleNumber}.pdf`);
  const logoPath = path.join(__dirname, "..", "..", "assets", "images", "ui", "logo_horizontal.png");
  const cbsLogoPath = path.join(__dirname, "..", "..", "assets", "images", "ui", "logo_koperasi_cbs.png");
  const emailHtml = buildReceiptEmailContent({
    recipientName: member?.name || to.split("@")[0],
    saleNumber,
    saleDate,
    cashierName,
    member,
    paymentMethod,
    amountPaid,
    changeAmount,
    discountAmount,
    notes,
    items,
  });

  return sendEmail({
    to,
    subject: `CBS Revora receipt ${saleNumber}`,
    text: `Hello,\n\nYour CBS Revora receipt for ${saleNumber} is attached.\n\nThank you.`,
    html: emailHtml,
    attachments: [
      {
        filename: attachmentName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
      { filename: "logo_cbs.png", path: cbsLogoPath, cid: "cbs-logo" },
      { filename: "logo.png", path: logoPath, cid: "revora-logo" },
    ],
  });
};

module.exports = {
  sendReceiptEmail,
};
