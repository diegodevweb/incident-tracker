import { NextResponse, type NextRequest } from "next/server";

// CSP com nonce por requisição: só roda script que o próprio Next marcou com o
// nonce (e o que esses scripts carregarem, via 'strict-dynamic'). Um <script>
// injetado por XSS não tem o nonce e é bloqueado, o que 'unsafe-inline' permitia.
// O Next lê o nonce do cabeçalho da requisição e o aplica sozinho aos scripts
// dele; por isso as páginas precisam ser renderizadas por requisição (o layout
// raiz lê headers()). Os demais cabeçalhos de segurança ficam no next.config.ts.
function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "img-src 'self' data: blob: https:",
    // Estilo inline continua liberado: o React usa o atributo style, que o nonce
    // não cobre, e CSS injetado não executa código.
    "style-src 'self' 'unsafe-inline'",
    // Em desenvolvimento o React usa eval para montar as pilhas de erro do servidor.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self' http: https:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    // Só páginas: as rotas /api devolvem JSON e os arquivos estáticos não
    // precisam de CSP. Prefetch do next/link também fica de fora.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
