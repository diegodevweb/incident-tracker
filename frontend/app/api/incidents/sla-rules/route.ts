import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

export async function GET() {
  return relayBackendResponse(await proxyToBackend("/incidents/sla-rules"));
}
