import type {
  IncidentEnvironment,
  IncidentFilter,
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  ReportExecutionStatus,
  UserRole,
} from "./types";

export const incidentPriorityLabel: Record<IncidentLevel, string> = {
  INFO: "Informativo",
  WARNING: "Aviso",
  ERROR: "Erro",
  CRITICAL: "Crítico",
};

export const dashboardIncidentPriorityLabel: Record<IncidentLevel, string> = {
  INFO: "Baixa",
  WARNING: "Média",
  ERROR: "Alta",
  CRITICAL: "Crítica",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  OPEN: "Aberto",
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

export const incidentSourceLabel: Record<IncidentSource, string> = {
  WEBHOOK: "Webhook",
  DASHBOARD: "Dashboard",
};

export function getIncidentPriorityLabel(
  priority: IncidentLevel,
  source?: IncidentSource,
) {
  if (source === "DASHBOARD") {
    return dashboardIncidentPriorityLabel[priority];
  }

  return incidentPriorityLabel[priority];
}

export const incidentEnvironmentLabel: Record<IncidentEnvironment, string> = {
  production: "Produção",
  staging: "Homologação",
  local: "Local",
};

export const incidentFilterLabel: Record<IncidentFilter, string> = {
  ALL: "Todos",
  WEBHOOK: "Webhook",
  DASHBOARD: "Dashboard",
  PRODUCTION: "Produção",
};

export const userRoleLabel: Record<UserRole, string> = {
  ADMIN: "Admin",
  CLIENT: "Cliente",
};

export const reportExecutionStatusLabel: Record<ReportExecutionStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  ATTENDED: "Atendido",
  ESCALATED: "Escalado",
};
