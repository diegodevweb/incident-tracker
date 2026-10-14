import { NextResponse } from "next/server";
import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

// O caminho pedido vira o caminho da chamada ao backend, então só passa o que
// estiver nesta lista: ids só com dígitos (até 10, o id é INT) e ações
// conhecidas. Qualquer outra coisa (inclusive "..", que o Next entrega
// decodificado) dá 404 sem chamar a API. Ver a rota /api/incidents/[id].
const ID = String.raw`\d{1,10}`;
const ALLOWED: Record<string, RegExp[]> = {
  GET: [
    /^$/,
    new RegExp(`^${ID}$`),
    new RegExp(`^${ID}/users$`),
    new RegExp(`^${ID}/webhook-keys$`),
  ],
  POST: [
    /^$/,
    new RegExp(`^${ID}/(disable|enable)$`),
    new RegExp(`^${ID}/users$`),
    new RegExp(`^${ID}/users/${ID}/(password-reset|disable|enable)$`),
    new RegExp(`^${ID}/webhook-keys$`),
  ],
  PATCH: [new RegExp(`^${ID}$`), new RegExp(`^${ID}/users/${ID}$`)],
  DELETE: [new RegExp(`^${ID}/webhook-keys/${ID}$`)],
};

type Context = RouteContext<"/api/companies/[[...path]]">;

async function forward(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const subpath = path.join("/");

  if (!ALLOWED[request.method]?.some((pattern) => pattern.test(subpath))) {
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  }

  // A busca e a paginação só existem na listagem.
  const search = subpath === "" ? new URL(request.url).search : "";
  // Ações como disable e password-reset vêm sem corpo.
  const body =
    request.method === "POST" || request.method === "PATCH"
      ? await request.text()
      : "";

  return relayBackendResponse(
    await proxyToBackend(`/companies${subpath ? `/${subpath}` : ""}${search}`, {
      method: request.method,
      ...(body
        ? { headers: { "Content-Type": "application/json" }, body }
        : {}),
    }),
  );
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
