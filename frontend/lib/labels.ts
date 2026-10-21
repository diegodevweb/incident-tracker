import type {
  Incident,
  IncidentEnvironment,
  IncidentFilter,
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  MonthlyReportEntry,
  ReportExecutionStatus,
  ResponseSlaState,
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

export const slaStateLabel: Record<ResponseSlaState, string> = {
  ON_TIME: "No prazo",
  AT_RISK: "Vence em breve",
  BREACHED: "Atrasado",
  MET: "Respondido no prazo",
  MISSED: "Respondido fora do prazo",
  CLOSED: "Resolvido sem resposta",
};

/** O selo dos chamados N1, que o suporte N1 do próprio cliente atende. */
export const N1_LABEL = "N1";

/** Situação e meta do SLA de uma linha do relatório, com os N1 à parte. */
export function reportSlaCells(
  entry: Pick<MonthlyReportEntry, "n1" | "slaState" | "slaTarget">,
) {
  if (entry.n1 || !entry.slaState) {
    return { state: "N1: fora do SLA", target: "Suporte N1 do cliente" };
  }

  return { state: slaStateLabel[entry.slaState], target: entry.slaTarget };
}

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
  N1: "N1",
  DELETED: "Excluídos",
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

/** Quantidade com o substantivo concordando: "1 mensagem", "3 mensagens". */
export function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Quem abriu o chamado, para mostrar ao lado da data ou da empresa. */
export function incidentAuthorLabel(
  incident: Pick<Incident, "source" | "createdByName">,
) {
  if (incident.createdByName) {
    return `por ${incident.createdByName}`;
  }

  return incident.source === "WEBHOOK" ? "pela integração" : "autor não registrado";
}
