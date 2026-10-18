/**
 * Card que abre e fecha pelo cabeçalho; começa fechado. O resumo (ex.: "3
 * mensagens") fica à vista para dizer o que tem dentro. Botões em `action`
 * não abrem nem fecham o card (ver RefreshButton).
 */
export function CollapsibleCard({
  title,
  description,
  summary,
  action,
  children,
}: {
  title: string;
  description: string;
  summary?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group app-surface card border">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-6 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-1.5 size-4 shrink-0 text-base-content/60 transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{title}</h3>
              {summary ? (
                <span className="badge badge-ghost badge-sm">{summary}</span>
              ) : null}
            </div>
            <p className="text-sm text-base-content/60">{description}</p>
          </div>
        </div>
        {action}
      </summary>

      <div className="space-y-6 px-6 pb-6">{children}</div>
    </details>
  );
}
