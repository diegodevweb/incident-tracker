import { getIncidentPriorityLabel, slaStateLabel } from "@/lib/labels";
import type {
  Incident,
  ResponseSla,
  ResponseSlaState,
  UserRole,
} from "@/lib/types";

// O expediente é o da API (backend/src/incidents/sla.ts).
export const businessHoursNote =
  "Horas úteis: seg. a sex., das 9h às 18h (horário de Brasília), sem feriados nacionais. O prazo para na primeira mensagem ou mudança de status da equipe. Se o chamado for reaberto, um prazo novo, com a mesma meta, começa na reabertura.";

const stateClassName: Record<ResponseSlaState, string> = {
  ON_TIME: "badge-success badge-outline",
  AT_RISK: "badge-warning",
  BREACHED: "badge-error",
  MET: "badge-success badge-soft",
  MISSED: "badge-error badge-soft",
  CLOSED: "badge-ghost",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const isSingular = (minutes: number) => minutes <= 1 || minutes === 60;

/** Minutos de expediente: "45min úteis", "1h útil", "2h 30min úteis". */
export function formatBusinessMinutes(total: number) {
  if (total < 1) {
    return "menos de 1min útil";
  }

  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const text = [hours ? `${hours}h` : "", minutes ? `${minutes}min` : ""]
    .filter(Boolean)
    .join(" ");

  return `${text} ${isSingular(total) ? "útil" : "úteis"}`;
}

/** O estado do prazo; sem prazo (null), o chamado é N1. */
export function IncidentSlaBadge({ sla }: { sla: ResponseSla | null }) {
  if (!sla) {
    return (
      <span className="badge badge-sm badge-neutral whitespace-nowrap">
        N1: fora do SLA
      </span>
    );
  }

  return (
    <span className={`badge badge-sm whitespace-nowrap ${stateClassName[sla.state]}`}>
      {slaStateLabel[sla.state]}
    </span>
  );
}

/** Para a lista: o estado e o horário que importa nele. */
export function IncidentSlaSummary({ sla }: { sla: ResponseSla | null }) {
  const hint = !sla
    ? "sem prazo da equipe"
    : sla.state === "ON_TIME" || sla.state === "AT_RISK"
      ? `vence ${formatDateTime(sla.dueAt)}`
      : sla.state === "BREACHED"
        ? `venceu ${formatDateTime(sla.dueAt)}`
        : sla.respondedAt
          ? `respondido ${formatDateTime(sla.respondedAt)}`
          : null;

  return (
    <div className="space-y-1">
      <IncidentSlaBadge sla={sla} />
      {sla?.cycle === "REOPENING" ? (
        <p className="whitespace-nowrap text-sm text-base-content/60">
          reaberto {formatDateTime(sla.startedAt)}
        </p>
      ) : null}
      {hint ? (
        <p className="whitespace-nowrap text-sm text-base-content/60">{hint}</p>
      ) : null}
    </div>
  );
}

function describeSla(sla: ResponseSla) {
  const reopened = sla.cycle === "REOPENING";
  const waiting = reopened
    ? "Aguardando a resposta da equipe à reabertura."
    : "Aguardando a primeira resposta da equipe.";

  switch (sla.state) {
    case "ON_TIME":
    case "AT_RISK": {
      const remaining = sla.remainingMinutes ?? 0;

      return `${waiting} ${
        isSingular(remaining) ? "Falta" : "Faltam"
      } ${formatBusinessMinutes(remaining)}.`;
    }
    case "BREACHED":
      return `${waiting} O prazo venceu há ${formatBusinessMinutes(
        sla.overdueMinutes ?? 0,
      )}.`;
    case "MET":
    case "MISSED": {
      if (sla.respondedAt === sla.startedAt) {
        return reopened
          ? "Chamado reaberto pela equipe: conta como respondido na reabertura."
          : "Chamado aberto pela equipe: conta como respondido na abertura.";
      }

      const when = sla.respondedAt ? formatDateTime(sla.respondedAt) : "";

      return sla.state === "MET"
        ? `A equipe respondeu em ${when}, ${formatBusinessMinutes(
            sla.responseMinutes ?? 0,
          )} depois da ${reopened ? "reabertura" : "abertura"}.`
        : `A equipe respondeu em ${when}, ${formatBusinessMinutes(
            sla.overdueMinutes ?? 0,
          )} depois do prazo.`;
    }
    case "CLOSED":
      return reopened
        ? "O chamado foi resolvido de novo antes da resposta da equipe à reabertura."
        : "O chamado foi resolvido antes da primeira resposta da equipe.";
  }
}

/** Para o detalhe: prazo, quanto falta ou quanto passou, e a regra. */
export function IncidentSlaCard({
  incident,
  role,
}: {
  incident: Incident;
  role: UserRole;
}) {
  const { sla } = incident;

  if (!sla) {
    return (
      <div className="app-surface-muted space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">SLA de resposta</p>
          <IncidentSlaBadge sla={null} />
        </div>
        <p className="text-sm">
          {role === "CLIENT"
            ? "Chamado N1, atendido pelo suporte N1 da sua empresa: não tem prazo de resposta da equipe de suporte."
            : "Classificado como N1: o atendimento fica com o suporte N1 do cliente, fora do prazo de resposta da equipe."}
        </p>
      </div>
    );
  }

  return (
    <div className="app-surface-muted space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {sla.cycle === "REOPENING"
            ? "SLA de resposta à reabertura"
            : "SLA de primeira resposta"}
        </p>
        <IncidentSlaBadge sla={sla} />
      </div>

      <p className="text-sm">{describeSla(sla)}</p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {sla.cycle === "REOPENING" ? (
          <div className="sm:col-span-2">
            <dt className="text-base-content/60">Reaberto em</dt>
            <dd className="font-medium">{formatDateTime(sla.startedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-base-content/60">Meta</dt>
          <dd className="font-medium">
            {getIncidentPriorityLabel(sla.priority, incident.source)}:{" "}
            {sla.target}
          </dd>
        </div>
        <div>
          <dt className="text-base-content/60">Prazo</dt>
          <dd className="font-medium">{formatDateTime(sla.dueAt)}</dd>
        </div>
      </dl>

      {sla.priority !== incident.priority ? (
        <p className="text-xs text-base-content/60">
          Vale a criticidade de quando a equipe respondeu; mudanças depois da
          resposta não alteram o prazo.
        </p>
      ) : null}

      <p className="text-xs text-base-content/60">{businessHoursNote}</p>
    </div>
  );
}
