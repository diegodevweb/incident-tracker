import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionCookieName,
  getTokenCookieName,
  proxyToBackend,
} from "@/lib/server-api";

export async function POST() {
  // Revoga o token na API antes de apagar os cookies. Se a API estiver fora do
  // ar ou o token já for inválido, o logout local continua valendo.
  try {
    await proxyToBackend("/auth/logout", { method: "POST" });
  } catch {
    // ignorado de propósito
  }

  const cookieStore = await cookies();
  cookieStore.delete(getTokenCookieName());
  cookieStore.delete(getSessionCookieName());
  return NextResponse.json({ ok: true });
}
