import { cookies, headers as requestHeaders } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_TOKEN_COOKIE = "incident-tracker.token";
const AUTH_SESSION_COOKIE = "incident-tracker.session";

export type BackendAuthSession = {
  accessToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: "ADMIN" | "CLIENT";
    mustChangePassword?: boolean;
  };
};

const authCookieOptions = ({ httpOnly }: { httpOnly: boolean }) => ({
  httpOnly,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
});

function getBackendBaseUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function getSessionCookieName() {
  return AUTH_SESSION_COOKIE;
}

export function getTokenCookieName() {
  return AUTH_TOKEN_COOKIE;
}

/**
 * Grava o token (httpOnly, só o servidor lê) e a sessão de exibição (nome,
 * e-mail, papel), que o front lê para montar a tela. Usado no login e na troca
 * de senha, que emite um token novo.
 */
export async function setAuthCookies(session: BackendAuthSession) {
  const cookieStore = await cookies();

  cookieStore.set(
    AUTH_TOKEN_COOKIE,
    session.accessToken,
    authCookieOptions({ httpOnly: true }),
  );
  cookieStore.set(
    AUTH_SESSION_COOKIE,
    JSON.stringify({ user: session.user }),
    authCookieOptions({ httpOnly: false }),
  );
}

/** Atualiza campos do usuário no cookie de sessão (ex.: nome editado). */
export async function updateSessionUser(
  changes: Partial<BackendAuthSession["user"]>,
) {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (!rawSession) {
    return;
  }

  try {
    const { user } = JSON.parse(rawSession) as {
      user: BackendAuthSession["user"];
    };

    cookieStore.set(
      AUTH_SESSION_COOKIE,
      JSON.stringify({ user: { ...user, ...changes } }),
      authCookieOptions({ httpOnly: false }),
    );
  } catch {
    // Cookie corrompido: fica como está, o próximo login regrava.
  }
}

/** Repassa status, corpo e Content-Type da resposta do backend. */
export async function relayBackendResponse(response: Response) {
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
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
