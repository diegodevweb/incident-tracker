import Link from "next/link";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { incidentAuthorLabel, incidentSourceLabel } from "@/lib/labels";
import type { Incident } from "@/lib/types";
import { IncidentPriorityBadge } from "./incident-priority-badge";
import { IncidentSlaSummary } from "./incident-sla";
import { IncidentStatusBadge } from "./incident-status-badge";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IncidentList({
  incidents,
  onRefresh,
}: {
  incidents: Incident[];
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="app-surface overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr className="text-base-content/60">
              <th>Ticket</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>SLA de resposta</th>
              <th>Origem</th>
              <th>Cliente</th>
              <th>
                <div className="flex items-center justify-between gap-2">
                  Criado em
                  <RefreshButton label="Atualizar tickets" onRefresh={onRefresh} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="hover">
                <td>
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="block space-y-1"
                  >
                    <p className="font-medium">{incident.title}</p>
                    <p className="max-w-md text-sm text-base-content/60">
                      {incident.description}
                    </p>
                  </Link>
                </td>
                <td>
                  <IncidentStatusBadge status={incident.status} />
                </td>
                <td>
                  <IncidentPriorityBadge
                    priority={incident.priority}
                    source={incident.source}
                  />
                </td>
                <td>
                  <IncidentSlaSummary sla={incident.sla} />
                </td>
                <td>
                  <div className="badge badge-outline">
                    {incidentSourceLabel[incident.source]}
                  </div>
                </td>
                <td>
                  <p>{incident.companyName}</p>
                  <p className="text-sm text-base-content/60">
                    {incidentAuthorLabel(incident)}
                  </p>
                </td>
                <td className="text-sm text-base-content/60">
                  {formatDate(incident.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
