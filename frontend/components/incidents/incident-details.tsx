import {
  incidentEnvironmentLabel,
  incidentSourceLabel,
  incidentStatusLabel,
} from "@/lib/labels";
import type { Incident } from "@/lib/types";
import { IncidentPriorityBadge } from "./incident-priority-badge";
import { IncidentStatusBadge } from "./incident-status-badge";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IncidentDetails({
  incident,
  role = "ADMIN",
}: {
  incident: Incident;
  role?: "ADMIN" | "CLIENT";
}) {
  const canReopen =
    role === "CLIENT" &&
    incident.source !== "WEBHOOK" &&
    incident.status === "RESOLVED";

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <IncidentStatusBadge status={incident.status} />
              <IncidentPriorityBadge
                priority={incident.priority}
                source={incident.source}
              />
              <span className="badge badge-outline">
                {incidentSourceLabel[incident.source]}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {incident.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/65">
                {incident.description}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm font-medium">Logs associados</p>
                <p className="mt-1 text-3xl font-semibold">{incident.logs.length}</p>
              </div>
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm font-medium">Anexos</p>
                <p className="mt-1 text-3xl font-semibold">
                  {incident.attachments.length}
                </p>
              </div>
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm font-medium">Origem</p>
                <p className="mt-1 text-3xl font-semibold">
                  {incidentSourceLabel[incident.source]}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {canReopen ? (
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm font-medium">Ação do cliente</p>
                <p className="mt-1 text-sm text-base-content/60">
                  Se o problema persistir, você pode reabrir este chamado para
                  nova análise.
                </p>
                <button type="button" className="btn btn-warning btn-sm mt-4">
                  Reabrir chamado
                </button>
              </div>
            ) : role === "CLIENT" ? (
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm font-medium">
                  {incident.source === "WEBHOOK"
                    ? "Atendimento automático"
                    : "Acompanhamento do chamado"}
                </p>
                <p className="mt-1 text-sm text-base-content/60">
                  {incident.source === "WEBHOOK"
                    ? "Chamados originados por webhook seguem fluxo interno rápido e não podem ser reabertos pelo cliente."
                    : `O ticket ainda está com status ${incidentStatusLabel[incident.status].toLowerCase()}. A reabertura só fica disponível após o encerramento.`}
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Cliente</p>
                <p className="mt-2 text-2xl font-semibold capitalize">{incident.clientName}</p>
              </div>
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Ambiente</p>
                <p className="mt-2 text-2xl font-semibold">
                  {incidentEnvironmentLabel[incident.environment]}
                </p>
              </div>
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Criado em</p>
                <p className="mt-2 text-lg font-semibold leading-tight">
                  {formatDate(incident.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
