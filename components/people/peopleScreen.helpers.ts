import type { PersonRow } from "./peopleScreen.types";

export const roleNames = (row: PersonRow) => (row.roles || []).map((role) => role.role_name).join(", ") || "-";
export const sanitizePersonNameInput = (value: string) => value.replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ");
export const sanitizePhoneInput = (value: string) => value.replace(/[^0-9+\-\s]/g, "").replace(/\s+/g, " ");
const countPhoneDigits = (value: string) => value.replace(/\D/g, "").length;
export const isValidPersonName = (value: string, required = false) => {
  const text = value.trim();
  if (!text) return !required;
  return /^[\p{L}\s]+$/u.test(text);
};
export const isValidPhone = (value: string) => {
  const text = value.trim();
  if (!text) return true;
  if (!/^[0-9+\-\s]{1,25}$/.test(text)) return false;
  if ((text.match(/\+/g) || []).length > 1 || (text.includes("+") && !text.startsWith("+"))) return false;
  const digitCount = countPhoneDigits(text);
  return digitCount >= 3 && digitCount <= 20;
};
