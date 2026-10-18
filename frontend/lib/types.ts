export type IncidentLevel = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type IncidentStatus = "OPEN" | "PENDING" | "IN_PROGRESS" | "RESOLVED";
export type IncidentSource = "WEBHOOK" | "DASHBOARD";
export type UserRole = "ADMIN" | "CLIENT";
export type IncidentEnvironment = "production" | "staging" | "local";
export type IncidentFilter = "ALL" | "WEBHOOK" | "DASHBOARD" | "PRODUCTION";
export type ReportExecutionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "ATTENDED"
  | "ESCALATED";

export type IncidentLog = {
  id: number;
  message: string;
  level: IncidentLevel;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type IncidentAttachment = {
  id: number;
  filename: string;
  mimeType: string;
  url: string;
  category?: "GENERAL" | "CORRECTIVE_ACTION";
};

export type IncidentEventType =
  | "INCIDENT_CREATED"
  | "STATUS_CHANGED"
  | "CORRECTIVE_ACTION_ADDED"
  | "CORRECTIVE_ACTION_REMOVED"
  | "ATTACHMENT_ADDED"
  | "LOG_REGISTERED"
  | "INCIDENT_RESOLVED"
  | "PRIORITY_CHANGED";

export type IncidentEvent = {
  id: number;
  type: IncidentEventType;
  createdAt: string;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
};

/** Mensagem da conversa do chamado; authorRole diz de que lado ela veio. */
export type IncidentComment = {
  id: number;
  message: string;
  createdAt: string;
  authorName: string;
  authorRole: UserRole;
};

export type FirstResponseSlaState =
  | "ON_TIME"
  | "AT_RISK"
  | "BREACHED"
  | "MET"
  | "MISSED"
  | "CLOSED";

/**
 * SLA de primeira resposta, calculado pela API na hora da leitura. Os minutos
 * são de expediente (seg. a sex., 8h às 18h de Brasília, sem feriados).
 */
export type FirstResponseSla = {
  state: FirstResponseSlaState;
  /** A criticidade que define o prazo: a da primeira resposta, ou a atual. */
  priority: IncidentLevel;
  target: string;
  dueAt: string;
  respondedAt: string | null;
  /** Até o prazo, enquanto o relógio corre. */
  remainingMinutes: number | null;
  /** Além do prazo: até agora (BREACHED) ou até a resposta (MISSED). */
  overdueMinutes: number | null;
  /** Da abertura à primeira resposta. */
  responseMinutes: number | null;
};

export type Incident = {
  id: number;
  title: string;
  description: string;
  correctiveActions?: string | null;
  status: IncidentStatus;
  priority: IncidentLevel;
  source: IncidentSource;
  environment: IncidentEnvironment;
  companyName: string;
  /** Quem abriu pelo painel; null quando veio do webhook ou é anterior ao registro. */
  createdByName: string | null;
  createdAt: string;
  logs: IncidentLog[];
  attachments: IncidentAttachment[];
  events?: IncidentEvent[];
  comments: IncidentComment[];
  sla: FirstResponseSla;
};

export type NotificationType =
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "COMMENT_ADDED"
  | "CORRECTIVE_ACTION_UPDATED";

/** Aviso ao cliente sobre o que a equipe fez num chamado da empresa dele. */
export type AppNotification = {
  id: number;
  type: NotificationType;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  incident: { id: number; title: string; source: IncidentSource };
};

export type NotificationList = {
  unreadCount: number;
  items: AppNotification[];
};

export type DashboardSummary = {
  total: number;
  open: number;
  critical: number;
  webhook: number;
};

/** A conta de quem está logado (GET /account). */
export type AccountProfile = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  createdAt: string;
  /** Empresa do usuário cliente; null para admin. */
  company: { id: number; name: string; cnpj: string | null } | null;
};

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Senha temporária: o painel só libera a troca de senha. */
  mustChangePassword?: boolean;
};

export type AuthSession = {
  user: AuthenticatedUser;
};

/** Empresa cliente como o admin vê (GET /companies). */
export type Company = {
  id: number;
  name: string;
  /** 14 caracteres sem pontuação; ver formatCnpj. */
  cnpj: string | null;
  disabledAt: string | null;
  createdAt: string;
  userCount: number;
  openIncidents: number;
};

export type CompanyListPage = {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
};

/** Usuário de uma empresa cliente (GET /companies/:id/users). */
export type CompanyUser = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  disabledAt: string | null;
  mustChangePassword: boolean;
};

/** Chave de webhook de uma empresa; a chave inteira só vem na criação. */
export type WebhookKey = {
  id: number;
  companyId: number;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type SlaRule = {
  priority: IncidentLevel;
  title: string;
  description: string;
  firstResponseTarget: string;
};

export type MonthlyReportEntry = {
  incidentId: number;
  title: string;
  createdAt: string;
  year: number;
  month: string;
  day: string;
  date: string;
  time: string;
  minute: string;
  second: string;
  errorType: IncidentLevel;
  source: IncidentSource;
  slaTarget: string;
  slaState: FirstResponseSlaState;
  priority: IncidentLevel;
  description: string;
  status?: IncidentStatus;
  companyName?: string;
  latestLogMessage?: string | null;
};

export type MonthlyReportCorrectiveAction = {
  incidentId: number;
  title: string;
  description: string | null;
  status: IncidentStatus;
  createdAt: string;
  attachments: IncidentAttachment[];
};

export type MonthlyReportPreventiveAction = {
  id: number;
  description: string;
  incidentId?: number | null;
  incidentTitle?: string | null;
  createdAt: string;
};

export type TechnicalIndicator = {
  label: string;
  value: string;
  status: ReportExecutionStatus;
};

export type MonthlyReport = {
  monthLabel: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  slaRules: SlaRule[];
  entries: MonthlyReportEntry[];
  correctiveActions: MonthlyReportCorrectiveAction[];
  preventiveActions: MonthlyReportPreventiveAction[];
  technicalIndicators: TechnicalIndicator[];
};

export type IncidentListSummary = {
  byStatus: Record<IncidentStatus, number>;
  byPriority: Record<IncidentLevel, number>;
  bySource: Record<IncidentSource, number>;
  /** Chamados sem resposta do conjunto filtrado, pelo estado do SLA. */
  sla: { breached: number; atRisk: number };
};

export type IncidentListPage = {
  items: Incident[];
  page: number;
  pageSize: number;
  total: number;
  summary: IncidentListSummary;
};
