import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server-api";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const response = await proxyToBackend(`/incidents${search}`);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function POST(request: Request) {
  const incomingForm = await request.formData();
  const formData = new FormData();

  incomingForm.forEach((value, key) => {
    formData.append(key, value);
  });

  const response = await proxyToBackend("/incidents", {
    method: "POST",
    body: formData,
  });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
