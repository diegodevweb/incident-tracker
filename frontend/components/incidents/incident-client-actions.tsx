"use client";

import { useState, useTransition } from "react";
import { updateIncident } from "@/lib/api";
import { incidentStatusLabel } from "@/lib/labels";
import type { Incident, IncidentStatus } from "@/lib/types";

/**
 * O que o cliente faz com o status: encerrar quando o problema acabou e
 * reabrir quando ele voltou. Os demais status ficam com a equipe.
 */
export function IncidentClientActions({
  incident,
  onUpdated,
}: {
  incident: Incident;
  onUpdated: (incident: Incident) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const resolved = incident.status === "RESOLVED";

  function changeStatus(status: IncidentStatus) {
    setError(null);
    startTransition(async () => {
      try {
        onUpdated(await updateIncident(incident.id, { status }));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível atualizar o chamado.",
        );
      }
    });
  }

  return (
    <div className="app-surface-muted rounded-2xl border p-4">
      <p className="text-sm font-medium">Ação do cliente</p>
      <p className="mt-1 text-sm text-base-content/60">
        {resolved
          ? "Se o problema voltou, reabra o chamado para nova análise."
          : `O chamado está ${incidentStatusLabel[incident.status].toLowerCase()}. Se o problema já foi resolvido, você pode encerrá-lo.`}
      </p>
      <button
        type="button"
        className={`btn btn-sm mt-4 ${resolved ? "btn-warning" : "btn-success"}`}
        disabled={isPending}
        onClick={() => changeStatus(resolved ? "OPEN" : "RESOLVED")}
      >
        {isPending
          ? "Salvando..."
          : resolved
            ? "Reabrir chamado"
            : "Marcar como resolvido"}
      </button>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
