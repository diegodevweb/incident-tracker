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
  | "INCIDENT_RESOLVED";

export type IncidentEvent = {
  id: number;
  type: IncidentEventType;
  createdAt: string;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
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
  clientName: string;
  createdAt: string;
  logs: IncidentLog[];
  attachments: IncidentAttachment[];
  events?: IncidentEvent[];
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
};

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  clientId?: number | null;
  /** Senha temporária: o painel só libera a troca de senha. */
  mustChangePassword?: boolean;
};

export type AuthSession = {
  user: AuthenticatedUser;
};

/** Cliente como o admin vê (GET /clients). */
export type ClientAccount = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  disabledAt: string | null;
  mustChangePassword: boolean;
  openIncidents: number;
};

export type ClientListPage = {
  items: ClientAccount[];
  total: number;
  page: number;
  pageSize: number;
};

export type SlaRule = {
  priority: IncidentLevel;
  title: string;
  description: string;
  firstResponseTarget: string;
};

export type MonthlyReportEntry = {
  incidentId: number;
  title?: string;
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
  priority: IncidentLevel;
  description: string;
  status?: IncidentStatus;
  clientName?: string;
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
};

export type IncidentListPage = {
  items: Incident[];
  page: number;
  pageSize: number;
  total: number;
  summary: IncidentListSummary;
};
