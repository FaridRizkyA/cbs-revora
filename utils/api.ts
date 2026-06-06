const API_URL = "http://192.168.100.169:3000";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || API_URL).replace(/\/$/, "");
