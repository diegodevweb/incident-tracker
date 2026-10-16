import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";
import { invalidIncidentIdResponse, isIncidentId } from "../incident-id";

export async function POST(
  request: Request,
  context: RouteContext<"/api/incidents/[id]/attachments">,
) {
  const { id } = await context.params;

  if (!isIncidentId(id)) {
    return invalidIncidentIdResponse();
  }

  const incomingForm = await request.formData();
  const formData = new FormData();

  incomingForm.forEach((value, key) => {
    formData.append(key, value);
  });

  return relayBackendResponse(
    await proxyToBackend(`/incidents/${id}/attachments`, {
      method: "POST",
      body: formData,
    }),
  );
}
