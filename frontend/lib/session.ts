import type { AuthSession, UserRole } from "./types";

export const AUTH_SESSION_STORAGE_KEY = "incident-tracker.session";

export function dashboardPathForRole(role: UserRole) {
  void role;
  return "/dashboard/incidents";
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  return value ? decodeURIComponent(value) : null;
}

export function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function saveAuthSession(session: AuthSession) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_SESSION_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; SameSite=Lax`;
}

export function getAuthSession() {
  const rawSession = readCookie(AUTH_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_SESSION_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
