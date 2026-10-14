const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Local calendar date as "YYYY-MM-DD". toISOString() would give the UTC date,
// which is still yesterday before 07:00 in Indonesia (UTC+7).
export const toLocalDateInput = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Parses DATE strings as local calendar dates and everything else with the Date constructor.
const parseDateValue = (value: string | Date) => {
  if (value instanceof Date) return value;
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

// Display format used across screens: "dd/MM/yyyy".
export const formatDisplayDate = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

// Display format used across screens: "dd/MM/yyyy, HH:mm:ss" (24 hour).
export const formatDisplayDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
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

// Formats a DATE ("YYYY-MM-DD") or timestamp value as a local "YYYY-MM-DD" string.
export const formatDateOnly = (value?: string | Date | null) => {
  if (!value) return "-";
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return toLocalDateInput(date);
};
