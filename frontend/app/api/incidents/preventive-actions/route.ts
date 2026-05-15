import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server-api";

export async function POST(request: Request) {
  const payload = await request.text();
  const response = await proxyToBackend("/incidents/preventive-actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
