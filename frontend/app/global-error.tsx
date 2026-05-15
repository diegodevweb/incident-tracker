"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="app-main flex min-h-screen items-center justify-center px-6">
        <div className="app-surface max-w-lg rounded-3xl border p-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-base-content/50">
            Erro inesperado
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Não foi possível carregar a aplicação
          </h1>
          <p className="mt-3 text-sm text-base-content/60">
            {error.message || "Tente novamente em instantes."}
          </p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => reset()}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
