import { IncidentEventType, NotificationType, Prisma } from '@prisma/client';
import type { NewIncidentEvent } from './incident-events';

/** Um aviso que vai para cada usuário da empresa do chamado. */
export type IncidentNotice = {
  type: NotificationType;
  metadata?: Prisma.InputJsonValue;
};

/**
 * O que o cliente fica sabendo de uma edição do chamado pela equipe. Ação
 * corretiva nova ou alterada e prints da correção viram um aviso só ("a solução
 * mudou"); apagar a ação corretiva não avisa. Na edição, todo anexo é print da
 * correção.
 */
export function noticesForIncidentUpdate(
  events: NewIncidentEvent[],
): IncidentNotice[] {
  const notices: IncidentNotice[] = [];
  let solutionUpdated = false;

  for (const event of events) {
    switch (event.type) {
      case IncidentEventType.STATUS_CHANGED:
      case IncidentEventType.INCIDENT_RESOLVED:
        notices.push({
          type: NotificationType.STATUS_CHANGED,
          metadata: event.metadata,
        });
        break;
      case IncidentEventType.PRIORITY_CHANGED:
        notices.push({
          type: NotificationType.PRIORITY_CHANGED,
          metadata: event.metadata,
        });
        break;
      case IncidentEventType.N1_CLASSIFIED:
        notices.push({ type: NotificationType.N1_CLASSIFIED });
        break;
      case IncidentEventType.N1_REMOVED:
        notices.push({ type: NotificationType.N1_REMOVED });
        break;
      case IncidentEventType.CORRECTIVE_ACTION_ADDED:
      case IncidentEventType.ATTACHMENT_ADDED:
        solutionUpdated = true;
        break;
    }
  }

  if (solutionUpdated) {
    notices.push({ type: NotificationType.CORRECTIVE_ACTION_UPDATED });
  }

  return notices;
}
