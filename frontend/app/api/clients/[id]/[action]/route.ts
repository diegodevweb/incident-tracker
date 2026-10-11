import { NextResponse } from "next/server";
import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

// Id e ação entram no caminho da chamada ao backend: só dígitos e só as ações
// conhecidas (ver a rota /api/incidents/[id]).
const CLIENT_ID_PATTERN = /^\d{1,10}$/;
const CLIENT_ACTIONS = new Set(["password-reset", "disable", "enable"]);

export async function POST(
  _request: Request,
  context: RouteContext<"/api/clients/[id]/[action]">,
) {
  const { id, action } = await context.params;

  if (!CLIENT_ID_PATTERN.test(id) || !CLIENT_ACTIONS.has(action)) {
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  }

  return relayBackendResponse(
    await proxyToBackend(`/clients/${id}/${action}`, { method: "POST" }),
  );
}
