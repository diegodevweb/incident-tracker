import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

export async function POST(request: Request) {
  return relayBackendResponse(
    await proxyToBackend("/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }),
  );
}
