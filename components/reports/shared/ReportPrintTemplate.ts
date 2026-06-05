import { Asset } from "expo-asset";
import { buildExportFileName, sanitizeFileNamePart } from "../../../utils/exportFileName";

export type ReportValue = string | number | boolean | Date | null | undefined;

export type ReportMetaItem = {
  label: string;
  value: ReportValue;
};

export type ReportTableColumn<Row> = {
  key: string;
  title: string;
  align?: "left" | "center" | "right";
  width?: string;
  getValue: (row: Row, index: number) => ReportValue;
};

export type ReportDetailField = {
  label: string;
  value: ReportValue;
};

export type ReportDetailSection = {
  title?: string;
  fields: ReportDetailField[];
};

export type ReportNestedTable = {
  title?: string;
  repeatReportHeader?: boolean;
  breakBefore?: boolean;
  columns: {
    key: string;
    title: string;
    align?: "left" | "center" | "right";
    width?: string;
  }[];
  rows: Record<string, ReportValue>[];
  footerRows?: {
    cells: {
      value: ReportValue;
      align?: "left" | "center" | "right";
      colspan?: number;
    }[];
  }[];
  emptyText?: string;
};

export type ReportDocumentInfo = {
  title: string;
  subtitle?: string;
  reportKey: string;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type ReportTablePrintData<Row> = ReportDocumentInfo & {
  rows: Row[];
  columns: ReportTableColumn<Row>[];
  emptyText?: string;
};

export type ReportDetailPrintData = ReportDocumentInfo & {
  documentNumber?: string | number | null;
  sections: ReportDetailSection[];
  tables?: ReportNestedTable[];
};

type ReportFileNameOptions = {
  reportKey: string;
  variant: "table" | "detail";
  documentNumber?: string | number | null;
  date?: string | Date | null;
};

const CBS_LOGO = require("../../../assets/images/ui/logo_koperasi_cbs.png");
const REVORA_LOGO = require("../../../assets/images/ui/logo_horizontal.png");

const getAssetUri = (asset: unknown) => {
  if (typeof asset === "number") {
    return Asset.fromModule(asset).uri || "";
  }

  if (asset && typeof asset === "object" && "uri" in asset && typeof (asset as { uri?: unknown }).uri === "string") {
    return (asset as { uri: string }).uri;
  }

  return "";
};
const CBS_LOGO_URI = getAssetUri(CBS_LOGO);
const REVORA_LOGO_URI = getAssetUri(REVORA_LOGO);

const escapeHtml = (value: ReportValue) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatReportDateTime = (value?: string | Date | null) => {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return String(value || "-");

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
};

const formatReportValue = (value: ReportValue) => {
  if (value instanceof Date) return formatReportDateTime(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  const stringValue = String(value);
  if (/^[A-Z0-9_]+$/.test(stringValue) && stringValue.includes("_")) {
    return stringValue.replace(/_/g, " ");
  }
  return stringValue;
};

const renderMetaItems = (items: ReportMetaItem[]) => {
  if (items.length === 0) return "";

  return `
    <section class="meta-grid meta-grid-${Math.min(items.length, 3)}">
      ${items
        .map(
          (item) => `
            <div class="meta-item">
              <div class="meta-label">${escapeHtml(item.label)}</div>
              <div class="meta-value">${escapeHtml(formatReportValue(item.value))}</div>
            </div>
          `
        )
        .join("")}
    </section>
  `;
};

const buildDocumentHead = (title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }

      .page {
        width: 100%;
        padding: 18mm 16mm;
      }

      .report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }

      .brand-logos {
        display: flex;
        align-items: center;
        gap: 0;
        min-width: 0;
      }

      .brand-logo-cbs {
        width: 52px;
        height: 52px;
        object-fit: contain;
        flex: 0 0 auto;
      }

      .brand-logo-revora {
        width: 190px;
        max-width: 44vw;
        height: 44px;
        object-fit: contain;
      }

      .report-subtitle,
      .muted {
        color: #475569;
      }

      .report-title {
        font-size: 20px;
        font-weight: 800;
        text-align: right;
      }

      .report-subtitle {
        text-align: right;
        margin-top: 2px;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 10px 0 12px;
      }

      .meta-grid-1 {
        grid-template-columns: minmax(0, 1fr);
      }

      .meta-grid-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .meta-item {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        min-height: 38px;
      }

      .meta-label {
        color: #64748b;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .meta-value {
        margin-top: 3px;
        font-weight: 700;
        word-break: break-word;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead {
        display: table-header-group;
      }

      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      th {
        background: #e2e8f0;
        color: #0f172a;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }

      th,
      td {
        border: 1px solid #cbd5e1;
        padding: 7px 8px;
        vertical-align: top;
        overflow-wrap: anywhere;
        word-break: break-word;
        white-space: pre-line;
      }

      tbody tr:nth-child(even) {
        background: #f8fafc;
      }

      .table-total-cell {
        background: #e2e8f0;
        font-weight: 800;
        text-transform: uppercase;
      }

      .text-left {
        text-align: left;
      }

      .text-center {
        text-align: center;
      }

      .text-right {
        text-align: right;
      }

      .empty {
        border: 1px solid #cbd5e1;
        color: #64748b;
        padding: 16px;
        text-align: center;
      }

      .detail-section {
        margin-top: 12px;
        break-inside: auto;
      }

      .detail-section-page {
        break-before: page;
        page-break-before: always;
      }

      .repeated-report-header {
        margin-bottom: 14px;
      }

      .section-title {
        background: #e2e8f0;
        border: 1px solid #cbd5e1;
        border-bottom: 0;
        font-size: 12px;
        font-weight: 800;
        padding: 8px 10px;
        text-transform: uppercase;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        border-top: 1px solid #cbd5e1;
        border-left: 1px solid #cbd5e1;
      }

      .detail-label,
      .detail-value {
        border-right: 1px solid #cbd5e1;
        border-bottom: 1px solid #cbd5e1;
        padding: 8px 10px;
        min-height: 34px;
      }

      .detail-label {
        background: #f8fafc;
        color: #475569;
        font-weight: 800;
      }

      .detail-value {
        font-weight: 700;
        word-break: break-word;
      }

      .footer {
        border-top: 1px solid #cbd5e1;
        color: #64748b;
        font-size: 10px;
        margin-top: 18px;
        padding-top: 8px;
        text-align: right;
      }

      @media print {
        @page {
          size: A4;
          margin: 18mm 16mm;
        }

        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .page {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>`;

const renderHeader = (data: ReportDocumentInfo) => {
  const metaItems: ReportMetaItem[] = [
    { label: "Generated At", value: formatReportDateTime(data.generatedAt) },
    ...(data.generatedBy ? [{ label: "Generated By", value: data.generatedBy }] : []),
    ...(data.meta || []),
  ];

  return `
    <main class="page">
      ${renderReportHeaderBlock(data)}
      <div>
        ${renderMetaItems(metaItems)}
      </div>
  `;
};

const renderFooter = () => `
      <footer class="footer">Generated by CBS Revora</footer>
    </main>
  </body>
</html>`;

const renderReportHeaderBlock = (data: ReportDocumentInfo, className = "report-header") => `
  <header class="${className}">
    <div>
      <div class="brand-logos">
        ${CBS_LOGO_URI ? `<img class="brand-logo-cbs" src="${escapeHtml(CBS_LOGO_URI)}" alt="CBS" />` : ""}
        ${REVORA_LOGO_URI ? `<img class="brand-logo-revora" src="${escapeHtml(REVORA_LOGO_URI)}" alt="Revora" />` : ""}
      </div>
    </div>
    <div>
      <div class="report-title">${escapeHtml(data.title)}</div>
      ${data.subtitle ? `<div class="report-subtitle">${escapeHtml(data.subtitle)}</div>` : ""}
    </div>
  </header>
`;

const renderNestedTables = (data: ReportDocumentInfo, tables: ReportNestedTable[] = []) =>
  tables
    .map((table) => {
      const headerCells = table.columns
        .map(
          (column) =>
            `<th class="text-${column.align || "left"}" ${column.width ? `style="width: ${escapeHtml(column.width)}"` : ""}>${escapeHtml(column.title)}</th>`
        )
        .join("");
      const bodyRows = table.rows
        .map(
          (row) => `
            <tr>
              ${table.columns
                .map((column) => `<td class="text-${column.align || "left"}">${escapeHtml(formatReportValue(row[column.key]))}</td>`)
                .join("")}
            </tr>
          `
        )
        .join("");
      const footerRows = (table.footerRows || [])
        .map(
          (row) => `
            <tr>
              ${row.cells
                .map(
                  (cell) =>
                    `<td class="text-${cell.align || "left"} table-total-cell" ${cell.colspan ? `colspan="${cell.colspan}"` : ""}>${escapeHtml(
                      formatReportValue(cell.value)
                    )}</td>`
                )
                .join("")}
            </tr>
          `
        )
        .join("");

      return `
        <section class="detail-section${table.breakBefore ? " detail-section-page" : ""}">
          ${table.repeatReportHeader ? `<div class="repeated-report-header">${renderReportHeaderBlock(data)}</div>` : ""}
          ${table.title ? `<div class="section-title">${escapeHtml(table.title)}</div>` : ""}
          ${table.rows.length === 0
            ? `<div class="empty">${escapeHtml(table.emptyText || "No data.")}</div>`
            : `<table>
                <thead>
                  <tr>${headerCells}</tr>
                </thead>
                <tbody>${bodyRows}${footerRows}</tbody>
              </table>`}
        </section>
      `;
    })
    .join("");

export const buildReportPdfFileName = ({
  reportKey,
  variant,
  documentNumber,
  date,
}: ReportFileNameOptions) => {
  const prefix = ["cbs-revora", reportKey, variant].map(sanitizeFileNamePart).filter(Boolean).join("-");

  return buildExportFileName({
    prefix: prefix || "report",
    documentNumber,
    date,
    extension: "pdf",
  });
};

export const buildReportTablePrintHtml = <Row,>(data: ReportTablePrintData<Row>) => {
  const fileName = buildReportPdfFileName({
    reportKey: data.reportKey,
    variant: "table",
    date: data.generatedAt,
  }).replace(/\.pdf$/i, "");
  const rows = data.rows || [];
  const columns = data.columns || [];

  const headerCells = columns
    .map(
      (column) =>
        `<th class="text-${column.align || "left"}" ${column.width ? `style="width: ${escapeHtml(column.width)}"` : ""}>${escapeHtml(column.title)}</th>`
    )
    .join("");
  const bodyRows = rows
    .map(
      (row, rowIndex) => `
        <tr>
          ${columns
            .map((column) => {
              const value = formatReportValue(column.getValue(row, rowIndex));
              return `<td class="text-${column.align || "left"}">${escapeHtml(value)}</td>`;
            })
            .join("")}
        </tr>
      `
    )
    .join("");

  return `${buildDocumentHead(fileName)}
      ${renderHeader(data)}
      ${rows.length === 0 || columns.length === 0
        ? `<div class="empty">${escapeHtml(data.emptyText || "No report data.")}</div>`
        : `<table>
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>`}
      ${renderFooter()}`;
};

export const buildReportDetailPrintHtml = (data: ReportDetailPrintData) => {
  const fileName = buildReportPdfFileName({
    reportKey: data.reportKey,
    variant: "detail",
    documentNumber: data.documentNumber,
    date: data.generatedAt,
  }).replace(/\.pdf$/i, "");

  const sections = data.sections
    .map(
      (section) => `
        <section class="detail-section">
          ${section.title ? `<div class="section-title">${escapeHtml(section.title)}</div>` : ""}
          <div class="detail-grid">
            ${section.fields
              .map(
                (field) => `
                  <div class="detail-label">${escapeHtml(field.label)}</div>
                  <div class="detail-value">${escapeHtml(formatReportValue(field.value))}</div>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");

  const tables = renderNestedTables(data, data.tables);

  return `${buildDocumentHead(fileName)}
      ${renderHeader(data)}
      ${sections || '<div class="empty">No detail data.</div>'}
      ${tables}
      ${renderFooter()}`;
};
