export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase letters, lowercase letters, and numbers.";

export const isValidPasswordPolicy = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

