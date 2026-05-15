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

export type UserProfile = {
  id: number;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  document: string;
  plan: string;
  preferredContact: string;
};

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  clientId?: number | null;
};

export type AuthSession = {
  user: AuthenticatedUser;
};

export type ClientAccount = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  environment: IncidentEnvironment;
  activeIncidents: number;
  slaPlan: string;
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
