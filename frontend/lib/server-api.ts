import { cookies, headers as requestHeaders } from "next/headers";

const AUTH_TOKEN_COOKIE = "incident-tracker.token";
const AUTH_SESSION_COOKIE = "incident-tracker.session";

export type BackendAuthSession = {
  accessToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: "ADMIN" | "CLIENT";
    clientId?: number | null;
  };
};

function getBackendBaseUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function getSessionCookieName() {
  return AUTH_SESSION_COOKIE;
}

export function getTokenCookieName() {
  return AUTH_TOKEN_COOKIE;
}

export async function getBackendToken() {
  return (await cookies()).get(AUTH_TOKEN_COOKIE)?.value ?? null;
}

// O proxy reverso (Caddy) deve sobrescrever X-Real-IP com o IP do cliente.
// Repassamos esse IP à API (que confia em 1 proxy via TRUST_PROXY=1) para que
// os limites de requisição valham por cliente, e não pelo IP deste servidor.
async function getClientIp() {
  const ip = (await requestHeaders()).get("x-real-ip")?.trim();

  return ip ? ip : null;
}

export async function proxyToBackend(
  path: string,
  init?: RequestInit,
) {
  const token = await getBackendToken();
  const headers = new Headers(init?.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const clientIp = await getClientIp();

  // Nunca repassa o que veio do cliente: só o valor definido pelo proxy.
  headers.delete("X-Forwarded-For");
  if (clientIp) {
    headers.set("X-Forwarded-For", clientIp);
  }

  return fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
