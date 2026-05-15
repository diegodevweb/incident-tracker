import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/server-api";

export async function GET() {
  const raw = (await cookies()).get(getSessionCookieName())?.value;

  if (!raw) {
    return NextResponse.json({ message: "Sessão não encontrada." }, { status: 401 });
  }

  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  }
}
