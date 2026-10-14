const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Local calendar date as "YYYY-MM-DD". toISOString() would give the UTC date,
// which is still yesterday before 07:00 in Indonesia (UTC+7).
export const toLocalDateInput = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Formats a DATE ("YYYY-MM-DD") or timestamp value as a local "YYYY-MM-DD" string.
export const formatDateOnly = (value?: string | Date | null) => {
  if (!value) return "-";
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return toLocalDateInput(date);
};
