const API_URL = "http://[YOUR_COMPUTER/SERVER_API]:3000";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || API_URL).replace(/\/$/, "");
