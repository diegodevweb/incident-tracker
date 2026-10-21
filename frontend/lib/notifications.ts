import { getIncidentPriorityLabel, incidentStatusLabel } from "./labels";
import type {
  AppNotification,
  IncidentLevel,
  IncidentStatus,
} from "./types";

// Quem marca avisos como lidos fora do sino (o detalhe do chamado) dispara este
// evento para o sino recontar.
export const NOTIFICATIONS_CHANGED_EVENT = "incident-tracker:notifications-changed";

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** A frase do aviso, montada a partir do tipo e do que mudou. */
export function notificationText(notification: AppNotification) {
  const metadata = notification.metadata ?? {};

  switch (notification.type) {
    case "STATUS_CHANGED": {
      const toStatus = incidentStatusLabel[metadata.toStatus as IncidentStatus];

      if (metadata.toStatus === "RESOLVED") {
        return "A equipe marcou o chamado como resolvido";
      }

      return toStatus
        ? `Status mudou para ${toStatus.toLowerCase()}`
        : "O status do chamado mudou";
    }
    case "PRIORITY_CHANGED": {
      const source = notification.incident.source;
      const fromPriority = getIncidentPriorityLabel(
        metadata.fromPriority as IncidentLevel,
        source,
      );
      const toPriority = getIncidentPriorityLabel(
        metadata.toPriority as IncidentLevel,
        source,
      );

      return fromPriority && toPriority
        ? `Criticidade mudou de ${fromPriority.toLowerCase()} para ${toPriority.toLowerCase()}`
        : "A criticidade do chamado mudou";
    }
    case "COMMENT_ADDED":
      return "Nova mensagem da equipe de suporte";
    case "CORRECTIVE_ACTION_UPDATED":
      return "A equipe registrou a solução aplicada";
    case "N1_CLASSIFIED":
      return "Classificado como N1: o atendimento fica com o suporte N1 da sua empresa";
    case "N1_REMOVED":
      return "A classificação N1 foi retirada: o chamado voltou para a equipe de suporte";
  }
}
