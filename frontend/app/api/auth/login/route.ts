import { NextResponse } from "next/server";
import {
  proxyToBackend,
  setAuthCookies,
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
  await setAuthCookies(session);

  return NextResponse.json({ user: session.user });
}
