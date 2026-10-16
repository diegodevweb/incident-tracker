import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";
import { invalidIncidentIdResponse, isIncidentId } from "../incident-id";

export async function POST(
  request: Request,
  context: RouteContext<"/api/incidents/[id]/comments">,
) {
  const { id } = await context.params;

  if (!isIncidentId(id)) {
    return invalidIncidentIdResponse();
  }

  return relayBackendResponse(
    await proxyToBackend(`/incidents/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }),
  );
}
