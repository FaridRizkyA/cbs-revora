const API_URL = "http://10.83.53.118:3000";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || API_URL).replace(/\/$/, "");
