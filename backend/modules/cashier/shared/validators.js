const toNumber = (value) => Number(value || 0);

const validatePositiveInteger = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return number;
};

const PHONE_ALLOWED_PATTERN = /^[0-9+\-\s]{1,25}$/;

const validatePhoneNumber = (phoneRaw) => {
  const phone = String(phoneRaw || "").trim();
  if (!phone) return null;

  if (!PHONE_ALLOWED_PATTERN.test(phone)) {
    throw new Error("phone_number format is invalid.");
  }

  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < 3 || digitsOnly.length > 20) {
    throw new Error("phone_number digits length must be between 3 and 20.");
  }

  const plusCount = (phone.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !phone.startsWith("+"))) {
    throw new Error("phone_number format is invalid.");
  }

  return phone.replace(/\s{2,}/g, " ");
};

module.exports = {
  toNumber,
  validatePositiveInteger,
  validatePhoneNumber,
};
