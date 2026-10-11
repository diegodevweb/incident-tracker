import type { AuthSession, UserRole } from "./types";

export const AUTH_SESSION_STORAGE_KEY = "incident-tracker.session";

export function dashboardPathForRole(role: UserRole) {
  void role;
  return "/dashboard/incidents";
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

// Recebe o valor do cookie da sessão já decodificado, como o Next entrega no
// servidor. Os componentes leem a sessão com useAuthSession.
export function parseAuthSession(rawSession: string | null) {
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
