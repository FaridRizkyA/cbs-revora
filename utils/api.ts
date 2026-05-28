const API_URL = "http://172.18.112.33:3000";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || API_URL).replace(/\/$/, "");
