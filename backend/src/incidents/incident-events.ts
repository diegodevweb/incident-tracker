import {
  AttachmentCategory,
  IncidentEventType,
  IncidentStatus,
  Prisma,
} from '@prisma/client';

/**
 * Como os eventos são carregados no detalhe do chamado. Do autor sai só o
 * nome: o cliente também vê a linha do tempo, e o e-mail de quem atendeu não
 * precisa ir junto.
 */
export const INCIDENT_EVENTS_QUERY = {
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  include: { actor: { select: { name: true } } },
} satisfies Prisma.Incident$eventsArgs;

type IncidentEventRow = Prisma.IncidentEventGetPayload<{
  include: typeof INCIDENT_EVENTS_QUERY.include;
}>;

export function toPublicIncidentEvent(event: IncidentEventRow) {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt,
    actorName: event.actor?.name ?? null,
    metadata: event.metadata,
  };
}

export type NewIncidentEvent = {
  type: IncidentEventType;
  actorId: number | null;
  metadata?: Prisma.InputJsonValue;
};

type AddedAttachment = { filename: string; category: AttachmentCategory };

export function attachmentAddedEvents(
  attachments: AddedAttachment[],
  actorId: number | null,
): NewIncidentEvent[] {
  return attachments.map((attachment) => ({
    type: IncidentEventType.ATTACHMENT_ADDED,
    actorId,
    // O front casa o evento com o anexo pelo nome; tem que ser o nome gravado.
    metadata: {
      filename: attachment.filename,
      category: attachment.category,
    },
  }));
}

/**
 * Eventos de uma edição do chamado, comparando com o estado antes dela. Campo
 * enviado com o mesmo valor não gera evento.
 */
export function incidentUpdateEvents(input: {
  current: { status: IncidentStatus; correctiveActions: string | null };
  status?: IncidentStatus;
  correctiveActions?: string | null;
  attachments: AddedAttachment[];
  actorId: number;
}): NewIncidentEvent[] {
  const { current, actorId } = input;
  const events: NewIncidentEvent[] = [];

  if (input.status && input.status !== current.status) {
    events.push({
      // Resolver ganha tipo próprio: é o marco que a linha do tempo destaca.
      type:
        input.status === IncidentStatus.RESOLVED
          ? IncidentEventType.INCIDENT_RESOLVED
          : IncidentEventType.STATUS_CHANGED,
      actorId,
      metadata: { fromStatus: current.status, toStatus: input.status },
    });
  }

  if (
    input.correctiveActions !== undefined &&
    input.correctiveActions !== current.correctiveActions
  ) {
    // O texto anterior vai junto para a auditoria mostrar o que foi substituído.
    const previous =
      current.correctiveActions !== null
        ? { previousDescription: current.correctiveActions }
        : {};

    events.push(
      input.correctiveActions !== null
        ? {
            type: IncidentEventType.CORRECTIVE_ACTION_ADDED,
            actorId,
            metadata: { description: input.correctiveActions, ...previous },
          }
        : {
            type: IncidentEventType.CORRECTIVE_ACTION_REMOVED,
            actorId,
            metadata: previous,
          },
    );
  }

  return [...events, ...attachmentAddedEvents(input.attachments, actorId)];
}
