import { apiGet, apiPost } from "@/lib/api";
import type { SessionUser } from "@/lib/userContext";
import { queryClient } from "@/lib/queryClient";

export type { SessionUser };

export function fetchSessionUser() {
  return apiGet<SessionUser>("/auth/me");
}

export function fetchPlatformUser() {
  return apiGet<PlatformUser>("/platform/auth/me");
}

export function requestPasswordReset(input: {
  email: string;
  account_type: "tenant" | "platform";
  tenant_slug?: string;
}) {
  return apiPost<{ message: string }>("/auth/password/forgot", input);
}

export function resetPassword(token: string, password: string) {
  return apiPost<{ message: string }>("/auth/password/reset", { token, password });
}

export function changePlatformPassword(currentPassword: string, newPassword: string) {
  return apiPost<{ message: string }>("/platform/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
}

export async function login(tenantSlug: string, email: string, password: string) {
  const user = await apiPost<SessionUser>("/auth/login", {
    tenant_slug: tenantSlug,
    email,
    password,
  });
  queryClient.clear();
  return user;
}

export async function platformLogin(email: string, password: string) {
  const user = await apiPost<PlatformUser>("/platform/auth/login", { email, password });
  queryClient.clear();
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

export async function platformLogout() {
  try {
    await apiPost<{ ok: boolean }>("/platform/auth/logout");
  } finally {
    queryClient.clear();
  }
}
