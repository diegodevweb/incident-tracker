import Link from "next/link";
import { CollapsibleCard } from "@/components/dashboard/collapsible-card";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  countLabel,
  incidentAuthorLabel,
  incidentSourceLabel,
} from "@/lib/labels";
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

/**
 * Tabela de tickets num card que recolhe. A tabela rola por dentro, com o
 * cabeçalho fixo, e o rodapé (paginação) fica sempre à vista embaixo dela.
 */
export function IncidentList({
  incidents,
  total,
  scrollKey,
  onRefresh,
  footer,
}: {
  incidents: Incident[];
  /** Total do filtro inteiro; sem ele (carregando ou erro) não há resumo nem aviso de vazio. */
  total?: number;
  /** Muda com a página ou o filtro; a tabela é recriada e volta ao topo. */
  scrollKey: string;
  onRefresh: () => Promise<void>;
  footer?: React.ReactNode;
}) {
  return (
    <CollapsibleCard
      title="Tickets"
      summary={
        total === undefined
          ? undefined
          : countLabel(total, "ticket", "tickets")
      }
      action={<RefreshButton label="Atualizar tickets" onRefresh={onRefresh} />}
      defaultOpen
      flush
      className="rounded-3xl"
    >
      <div
        key={scrollKey}
        className="max-h-[70vh] overflow-auto border-t border-base-content/5"
      >
        <table className="table table-pin-rows [&_thead_tr]:bg-(--app-surface)">
          <thead>
            <tr className="text-base-content/60">
              <th>Ticket</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>SLA de resposta</th>
              <th>Origem</th>
              <th>Cliente</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {total !== undefined && incidents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-sm text-base-content/60"
                >
                  {total === 0
                    ? "Nenhum ticket encontrado."
                    : "Nenhum ticket nesta página."}
                </td>
              </tr>
            ) : null}
            {incidents.map((incident) => (
              <tr key={incident.id} className="hover">
                <td>
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="block space-y-1"
                  >
                    <p className="font-medium">{incident.title}</p>
                    <p className="line-clamp-2 max-w-md break-words text-sm text-base-content/60">
                      {incident.description}
                    </p>
                    {incident.deletedAt ? (
                      <p className="max-w-md text-sm text-warning">
                        Excluído
                        {incident.deletedByName
                          ? ` por ${incident.deletedByName}`
                          : ""}{" "}
                        em {formatDate(incident.deletedAt)}
                        {incident.deletionReason
                          ? `: ${incident.deletionReason}`
                          : ""}
                      </p>
                    ) : null}
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

      {footer ? (
        <div className="border-t border-base-content/5 px-6 py-4">{footer}</div>
      ) : null}
    </CollapsibleCard>
  );
}
