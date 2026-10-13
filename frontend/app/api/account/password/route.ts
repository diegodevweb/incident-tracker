import { NextResponse } from "next/server";
import {
  proxyToBackend,
  relayBackendResponse,
  setAuthCookies,
  type BackendAuthSession,
} from "@/lib/server-api";

// A API troca a senha, derruba as outras sessões e devolve um token novo para
// esta. O token fica só no cookie httpOnly; o navegador recebe só o usuário.
export async function POST(request: Request) {
  const response = await proxyToBackend("/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });

  if (!response.ok) {
    return relayBackendResponse(response);
  }

  const session = (await response.json()) as BackendAuthSession;
  await setAuthCookies(session);

  return NextResponse.json({ user: session.user });
}
