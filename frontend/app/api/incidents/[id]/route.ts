import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server-api";

// O id entra no caminho da chamada ao backend. Sem esta checagem, um valor como
// "..%2Ferror-logs" (o Next entrega o parâmetro decodificado) faria o proxy
// chamar outra rota da API com o token do usuário. Até 10 dígitos: o id é INT.
const INCIDENT_ID_PATTERN = /^\d{1,10}$/;

function invalidIncidentIdResponse() {
  return NextResponse.json(
    { message: "Chamado não encontrado." },
    { status: 404 },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/incidents/[id]">,
) {
  const { id } = await context.params;

  if (!INCIDENT_ID_PATTERN.test(id)) {
    return invalidIncidentIdResponse();
  }

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

  if (!INCIDENT_ID_PATTERN.test(id)) {
    return invalidIncidentIdResponse();
  }

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
