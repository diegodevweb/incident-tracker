import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName, getTokenCookieName } from "@/lib/server-api";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(getTokenCookieName());
  cookieStore.delete(getSessionCookieName());
  return NextResponse.json({ ok: true });
}
