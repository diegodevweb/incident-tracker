import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server-api";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const response = await proxyToBackend(`/incidents/reports/monthly${search}`);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
