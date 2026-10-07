import { apiGet, apiPost } from "@/lib/api";
import type { SessionUser } from "@/lib/userContext";
import { queryClient } from "@/lib/queryClient";

export type { SessionUser };

export function fetchSessionUser() {
  return apiGet<SessionUser>("/auth/me");
}

// The backend sets the httpOnly session cookie on the login response; the react-query
// cache is invalidated so every signed-in query refetches under the new session.
export async function login(email: string, password: string) {
  const user = await apiPost<SessionUser>("/auth/login", { email, password });
  await queryClient.invalidateQueries();
  return user;
}

// Always sign out through here: clearing the whole cache stops this account's data
// leaking into the next login on this browser.
export async function logout() {
  try {
    await apiPost<{ ok: boolean }>("/auth/logout");
  } finally {
    queryClient.clear();
  }
}
