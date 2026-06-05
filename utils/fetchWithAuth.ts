import { API_BASE_URL } from "./api";
import { getAuthSession } from "./authSession";

type FetchWithAuthInit = RequestInit & {
  requireToken?: boolean;
};

export const fetchWithAuth = async (path: string, init: FetchWithAuthInit = {}) => {
  const session = await getAuthSession();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (init.requireToken && !session?.token) {
    throw new Error("Session token not found.");
  }

  return response;
};
