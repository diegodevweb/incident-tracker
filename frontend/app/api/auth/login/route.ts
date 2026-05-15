import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionCookieName,
  getTokenCookieName,
  proxyToBackend,
  type BackendAuthSession,
} from "@/lib/server-api";

export async function POST(request: Request) {
  const payload = await request.text();
  const response = await proxyToBackend("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  });

  const text = await response.text();

  if (!response.ok) {
    return new NextResponse(text || "Falha ao autenticar.", {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/plain",
      },
    });
  }

  const session = JSON.parse(text) as BackendAuthSession;
  const cookieStore = await cookies();

  cookieStore.set(getTokenCookieName(), session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  cookieStore.set(getSessionCookieName(), JSON.stringify({ user: session.user }), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ user: session.user });
}
