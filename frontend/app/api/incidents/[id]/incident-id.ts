import { NextResponse } from "next/server";

// O id entra no caminho da chamada ao backend. Sem esta checagem, um valor como
// "..%2Ferror-logs" (o Next entrega o parâmetro decodificado) faria o proxy
// chamar outra rota da API com o token do usuário. Até 10 dígitos: o id é INT.
const INCIDENT_ID_PATTERN = /^\d{1,10}$/;

export function isIncidentId(id: string) {
  return INCIDENT_ID_PATTERN.test(id);
}

export function invalidIncidentIdResponse() {
  return NextResponse.json(
    { message: "Chamado não encontrado." },
    { status: 404 },
  );
}
