import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

export async function GET(request: Request) {
  const { search } = new URL(request.url);

  return relayBackendResponse(await proxyToBackend(`/clients${search}`));
}

export async function POST(request: Request) {
  return relayBackendResponse(
    await proxyToBackend("/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }),
  );
}
