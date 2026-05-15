"use client";

import { incidentStatusLabel } from "@/lib/labels";
import type { Incident, IncidentEvent, IncidentStatus } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return incidentStatusLabel[value as IncidentStatus] ?? value;
}

function getEventContent(event: IncidentEvent) {
  const metadata = event.metadata ?? {};

  switch (event.type) {
    case "INCIDENT_CREATED":
      return {
        title: "Chamado criado",
        description: "Registro inicial do incidente no sistema.",
        metadata: null,
      };
    case "STATUS_CHANGED": {
      const fromStatus = getStatusLabel(metadata.fromStatus);
      const toStatus = getStatusLabel(metadata.toStatus);

      return {
        title: "Status atualizado",
        description:
          fromStatus && toStatus
            ? `Mudança de ${fromStatus.toLowerCase()} para ${toStatus.toLowerCase()}.`
            : "Fluxo do atendimento avançou para uma nova etapa.",
        metadata: null,
      };
    }
    case "CORRECTIVE_ACTION_ADDED":
      return {
        title: "Ação corretiva registrada",
        description:
          typeof metadata.description === "string" && metadata.description.trim()
            ? metadata.description
            : "Uma ação corretiva foi adicionada ao atendimento.",
        metadata: null,
      };
    case "ATTACHMENT_ADDED":
      return {
        title: "Evidência anexada",
        description:
          typeof metadata.filename === "string" && metadata.filename.trim()
            ? `Arquivo vinculado: ${metadata.filename}.`
            : "Uma evidência foi anexada ao chamado.",
        metadata: null,
      };
    case "LOG_REGISTERED":
      return {
        title: "Log técnico registrado",
        description:
          typeof metadata.message === "string" && metadata.message.trim()
            ? metadata.message
            : "Novo evento técnico associado ao incidente.",
        metadata: metadata,
      };
    case "INCIDENT_RESOLVED":
      return {
        title: "Chamado resolvido",
        description: "Atendimento concluído e incidente marcado como resolvido.",
        metadata: null,
      };
    default:
      return {
        title: "Evento técnico",
        description: "Atualização registrada no histórico do chamado.",
        metadata: metadata,
      };
  }
}

function getActorName(
  event: IncidentEvent | { actorName?: string | null },
) {
  return "actorName" in event ? event.actorName : undefined;
}

export function IncidentTimeline({
  incident,
}: {
  incident: Incident;
}) {
  const baseEvents = [...(incident.events ?? [])];
  const hasCreatedEvent = baseEvents.some(
    (event) => event.type === "INCIDENT_CREATED",
  );
  const hasCorrectiveActionEvent = baseEvents.some(
    (event) => event.type === "CORRECTIVE_ACTION_ADDED",
  );
  const hasResolvedEvent = baseEvents.some(
    (event) => event.type === "INCIDENT_RESOLVED",
  );

  if (!hasCreatedEvent) {
    baseEvents.push({
      id: -(incident.id * 100),
      type: "INCIDENT_CREATED",
      createdAt: incident.createdAt,
    });
  }

  if (incident.correctiveActions?.trim() && !hasCorrectiveActionEvent) {
    baseEvents.push({
      id: -incident.id,
      type: "CORRECTIVE_ACTION_ADDED",
      createdAt: incident.logs.at(-1)?.occurredAt ?? incident.createdAt,
      metadata: {
        description: incident.correctiveActions,
      },
    });
  }

  if (incident.status === "RESOLVED" && !hasResolvedEvent) {
    baseEvents.push({
      id: -(incident.id * 10),
      type: "INCIDENT_RESOLVED",
      createdAt: incident.logs.at(-1)?.occurredAt ?? incident.createdAt,
    });
  }

  const attachmentEvents = incident.attachments
    .filter((attachment) =>
      !baseEvents.some(
        (event) =>
          event.type === "ATTACHMENT_ADDED" &&
          event.metadata?.filename === attachment.filename,
      ),
    )
    .map((attachment, index) => ({
      id: -(incident.id * 1000) - index,
      type: "ATTACHMENT_ADDED" as const,
      createdAt: incident.logs.at(-1)?.occurredAt ?? incident.createdAt,
      metadata: {
        filename: attachment.filename,
      },
    }));

  const logEvents = incident.logs
    .filter(
      (log) =>
        !baseEvents.some(
          (event) =>
            event.type === "LOG_REGISTERED" &&
            event.createdAt === (log.occurredAt ?? incident.createdAt) &&
            event.metadata?.message === log.message,
        ),
    )
    .map((log, index) => ({
      id: -(incident.id * 10000) - index,
      type: "LOG_REGISTERED" as const,
      createdAt: log.occurredAt ?? incident.createdAt,
      metadata: {
        message: log.message,
        level: log.level,
        ...(log.metadata ?? {}),
      },
    }));

  const orderedEvents = [...baseEvents, ...attachmentEvents, ...logEvents].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div>
          <h3 className="text-lg font-semibold">Timeline técnica</h3>
          <p className="text-sm text-base-content/60">
            Histórico operacional do incidente com mudanças de status, ações e
            evidências.
          </p>
        </div>

        {orderedEvents.length ? (
          <div className="space-y-4">
            {orderedEvents.map((event, index) => {
              const content = getEventContent(event);

              return (
                <article
                  key={event.id}
                  className="grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)]"
                >
                  <div className="text-sm text-base-content/55">
                    {formatDate(event.createdAt)}
                  </div>
                  <div className="relative rounded-2xl border border-base-300 bg-base-100 p-4">
                    {index < orderedEvents.length - 1 ? (
                      <span className="absolute -bottom-5 left-5 h-5 w-px bg-base-300" />
                    ) : null}
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{content.title}</p>
                          {getActorName(event) ? (
                            <span className="badge badge-ghost badge-sm">
                              {getActorName(event)}
                            </span>
                          ) : null}
                          {event.type === "LOG_REGISTERED" &&
                          typeof event.metadata?.level === "string" ? (
                            <span className="badge badge-outline badge-sm">
                              {event.metadata.level}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-base-content/70">
                          {content.description}
                        </p>
                        {content.metadata ? (
                          <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral p-4 text-xs text-neutral-content">
                            {JSON.stringify(content.metadata, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="app-surface-muted rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
            Nenhum histórico técnico disponível.
          </div>
        )}
      </div>
    </section>
  );
}
