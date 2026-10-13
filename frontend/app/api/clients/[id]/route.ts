import { NextResponse } from "next/server";
import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

// O id entra no caminho da chamada ao backend: só dígitos (ver a rota
// /api/incidents/[id]).
const CLIENT_ID_PATTERN = /^\d{1,10}$/;

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/clients/[id]">,
) {
  const { id } = await context.params;

  if (!CLIENT_ID_PATTERN.test(id)) {
    return NextResponse.json(
      { message: "Cliente não encontrado." },
      { status: 404 },
    );
  }

  return relayBackendResponse(
    await proxyToBackend(`/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }),
  );
}
