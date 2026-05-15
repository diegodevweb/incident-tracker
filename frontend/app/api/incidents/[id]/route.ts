import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server-api";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/incidents/[id]">,
) {
  const { id } = await context.params;
  const response = await proxyToBackend(`/incidents/${id}`);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/incidents/[id]">,
) {
  const { id } = await context.params;
  const contentType = request.headers.get("Content-Type") ?? "";
  const body =
    contentType.includes("multipart/form-data")
      ? await request.formData()
      : await request.text();

  const response = await proxyToBackend(`/incidents/${id}`, {
    method: "PATCH",
    headers: contentType.includes("multipart/form-data")
      ? undefined
      : { "Content-Type": contentType || "application/json" },
    body,
  });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
