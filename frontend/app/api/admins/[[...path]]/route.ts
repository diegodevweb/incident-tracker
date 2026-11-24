import { NextResponse } from "next/server";
import { proxyToBackend, relayBackendResponse } from "@/lib/server-api";

// Mesma lista fechada da rota /api/companies: o caminho pedido vira o caminho
// da chamada ao backend, então só passam ids com dígitos e ações conhecidas.
const ID = String.raw`\d{1,10}`;
const ALLOWED: Record<string, RegExp[]> = {
  GET: [/^$/],
  POST: [/^$/, new RegExp(`^${ID}/(password-reset|disable|enable)$`)],
  PATCH: [new RegExp(`^${ID}$`)],
};

type Context = RouteContext<"/api/admins/[[...path]]">;

async function forward(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const subpath = path.join("/");

  if (!ALLOWED[request.method]?.some((pattern) => pattern.test(subpath))) {
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  }

  // Ações como disable e password-reset vêm sem corpo.
  const body =
    request.method === "POST" || request.method === "PATCH"
      ? await request.text()
      : "";

  return relayBackendResponse(
    await proxyToBackend(`/admins${subpath ? `/${subpath}` : ""}`, {
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
