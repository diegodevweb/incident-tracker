import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  incidentAuthorLabel,
  incidentEnvironmentLabel,
  incidentSourceLabel,
} from "@/lib/labels";
import type { Incident } from "@/lib/types";
import { IncidentClientActions } from "./incident-client-actions";
import { IncidentPriorityBadge } from "./incident-priority-badge";
import { IncidentSlaCard } from "./incident-sla";
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
  onUpdated,
  onRefresh,
}: {
  incident: Incident;
  role?: "ADMIN" | "CLIENT";
  onUpdated: (incident: Incident) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="app-surface card border">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between gap-3">
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
          <RefreshButton label="Atualizar chamado" onRefresh={onRefresh} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-3">
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
            {role === "CLIENT" ? (
              <IncidentClientActions incident={incident} onUpdated={onUpdated} />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Cliente</p>
                <p className="mt-2 text-2xl font-semibold">{incident.companyName}</p>
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
                <p className="mt-1 text-sm text-base-content/60">
                  {incidentAuthorLabel(incident)}
                </p>
              </div>
            </div>

            <IncidentSlaCard incident={incident} />
          </div>
        </div>
      </div>
    </section>
  );
}
