type BuildExportFileNameOptions = {
  prefix: string;
  documentNumber?: string | number | null;
  date?: string | Date | null;
  extension?: string;
};

const padDatePart = (value: number) => String(value).padStart(2, "0");

const formatDateToken = (value?: string | Date | null) => {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());

  return `${year}${month}${day}-${hour}${minute}${second}`;
};

export const sanitizeFileNamePart = (value: string | number | null | undefined) =>
  String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const buildExportFileName = ({
  prefix,
  documentNumber,
  date,
  extension = "pdf",
}: BuildExportFileNameOptions) => {
  const parts = [prefix, documentNumber, formatDateToken(date)]
    .map(sanitizeFileNamePart)
    .filter(Boolean);
  const baseName = parts.length > 0 ? parts.join("-") : "export";
  const normalizedExtension = sanitizeFileNamePart(extension).replace(/^\.+/, "") || "pdf";

  return `${baseName}.${normalizedExtension}`;
};
