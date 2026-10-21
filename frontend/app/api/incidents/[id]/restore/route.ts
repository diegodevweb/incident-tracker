import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";
import { invalidIncidentIdResponse, isIncidentId } from "../incident-id";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/incidents/[id]/restore">,
) {
  const { id } = await context.params;

  if (!isIncidentId(id)) {
    return invalidIncidentIdResponse();
  }

  return relayBackendResponse(
    await proxyToBackend(`/incidents/${id}/restore`, { method: "POST" }),
  );
}
