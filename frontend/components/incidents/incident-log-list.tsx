import type { IncidentLog } from "@/lib/types";

function formatDate(value?: string) {
  if (!value) return "Sem horário informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IncidentLogList({ logs }: { logs: IncidentLog[] }) {
  return (
    <section className="app-surface card border">
      <div className="card-body">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Logs técnicos</h3>
          <p className="text-sm text-base-content/60">
            Registros brutos capturados via webhook ou suporte manual.
          </p>
        </div>

        <ul className="timeline timeline-vertical timeline-snap-icon max-md:timeline-compact">
          {logs.map((log) => (
            <li key={log.id}>
              <div className="timeline-middle">
                <div className="badge badge-primary badge-sm" />
              </div>
              <div className="app-surface-muted timeline-end mb-6 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-outline">{log.level}</span>
                  <span className="text-xs text-base-content/50">
                    {formatDate(log.occurredAt)}
                  </span>
                </div>
                <p className="mt-3 font-medium">{log.message}</p>
                {log.metadata ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral p-4 text-xs text-neutral-content">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
              <hr />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
