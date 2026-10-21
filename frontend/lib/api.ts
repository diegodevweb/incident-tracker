import type {
  AccountProfile,
  AuthSession,
  Company,
  CompanyListPage,
  CompanyUser,
  Incident,
  IncidentComment,
  IncidentEnvironment,
  IncidentEvent,
  IncidentLevel,
  IncidentListPage,
  IncidentListSummary,
  IncidentSource,
  IncidentStatus,
  MonthlyReport,
  NotificationList,
  ResponseSla,
  SlaRule,
  WebhookKey,
} from "./types";

type BackendIncident = {
  id: number;
  title: string;
  description: string;
  correctiveActions?: string | null;
  status: IncidentStatus;
  priority: IncidentLevel;
  source: IncidentSource;
  environment: IncidentEnvironment;
  createdAt: string;
  updatedAt: string;
  companyId: number;
  company: { id: number; name: string };
  // A criação pelo webhook não traz o autor.
  createdBy?: { id: number; name: string } | null;
  n1ClassifiedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: { id: number; name: string } | null;
  deletionReason?: string | null;
  // Só o detalhe diz se quem está logado pode excluir.
  canDelete?: boolean;
  // A listagem não traz anexos nem logs; só o detalhe.
  attachments?: {
    id: number;
    filename: string;
    mimeType: string;
    url: string;
    category?: "GENERAL" | "CORRECTIVE_ACTION";
  }[];
  logs?: {
    id: number;
    message: string;
    level: IncidentLevel;
    occurredAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }[];
  events?: {
    id: number;
    type: IncidentEvent["type"];
    createdAt: string;
    actorName?: string | null;
    metadata?: Record<string, unknown> | null;
  }[];
  comments?: IncidentComment[];
  sla: ResponseSla | null;
};

/**
 * Erro de uma chamada à API, com a mensagem do backend quando ele manda uma
 * (o Nest responde { message } com texto ou lista de textos).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function readErrorMessage(text: string, status: number) {
  try {
    const { message } = JSON.parse(text) as { message?: unknown };

    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(". ");
  } catch {
    // Corpo não é JSON: cai na mensagem genérica.
  }

  return text || `Erro ao consumir API: ${status}`;
}

function getApiBaseUrl() {
  return "/api";
}

async function endSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.assign("/login");
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    // Sessão revogada (logout em outro lugar, usuário removido) ou expirada:
    // limpa os cookies e volta ao login. O próprio login devolve 401 para senha errada.
    if (response.status === 401 && path !== "/auth/login") {
      void endSession();
    }

    const text = await response.text();
    throw new ApiError(response.status, readErrorMessage(text, response.status));
  }

  return response.json() as Promise<T>;
}

function mapIncident(incident: BackendIncident): Incident {
  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    correctiveActions: incident.correctiveActions ?? undefined,
    status: incident.status,
    priority: incident.priority,
    source: incident.source,
    environment: incident.environment,
    companyName: incident.company.name,
    createdByName: incident.createdBy?.name ?? null,
    createdAt: incident.createdAt,
    attachments: incident.attachments ?? [],
    logs: (incident.logs ?? []).map((log) => ({
      id: log.id,
      message: log.message,
      level: log.level,
      occurredAt: log.occurredAt ?? undefined,
      metadata: log.metadata ?? undefined,
    })),
    events: incident.events?.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      actorName: event.actorName ?? undefined,
      metadata: event.metadata ?? undefined,
    })),
    comments: incident.comments ?? [],
    sla: incident.sla,
    n1ClassifiedAt: incident.n1ClassifiedAt ?? null,
    deletedAt: incident.deletedAt ?? null,
    deletedByName: incident.deletedBy?.name ?? null,
    deletionReason: incident.deletionReason ?? null,
    canDelete: incident.canDelete ?? false,
  };
}

type BackendIncidentPage = {
  items: BackendIncident[];
  page: number;
  pageSize: number;
  total: number;
  summary: IncidentListSummary;
};

export async function fetchIncidents(
  query?: Record<string, string | number | undefined>,
): Promise<IncidentListPage> {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const data = await apiFetch<BackendIncidentPage>(
    `/incidents${params.size ? `?${params.toString()}` : ""}`,
  );

  return { ...data, items: data.items.map(mapIncident) };
}

export async function fetchIncident(id: number) {
  const data = await apiFetch<BackendIncident>(`/incidents/${id}`);
  return mapIncident(data);
}

export async function fetchMonthlyReport(startDate: string, endDate: string, companyId?: number) {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  if (companyId) {
    params.set("companyId", String(companyId));
  }

  return apiFetch<MonthlyReport>(`/incidents/reports/monthly?${params.toString()}`);
}

export async function createIncident(payload: {
  /** Só o admin envia; o cliente abre na própria empresa. */
  companyId?: number;
  title: string;
  description: string;
  environment: IncidentEnvironment;
  priority: IncidentLevel;
  attachments?: File[];
}) {
  const formData = new FormData();
  if (payload.companyId) {
    formData.set("companyId", String(payload.companyId));
  }
  formData.set("title", payload.title);
  formData.set("description", payload.description);
  formData.set("environment", payload.environment);
  formData.set("priority", payload.priority);

  payload.attachments?.forEach((attachment) => {
    formData.append("attachments", attachment);
  });

  const data = await apiFetch<{ message: string; data: BackendIncident }>("/incidents", {
    method: "POST",
    body: formData,
  });

  return {
    message: data.message,
    incident: mapIncident(data.data),
  };
}

export async function updateIncident(
  id: number,
  payload: {
    status?: IncidentStatus;
    priority?: IncidentLevel;
    correctiveActions?: string;
    /** Só o admin classifica como N1. */
    n1?: boolean;
    correctiveAttachments?: File[];
  },
) {
  const { correctiveAttachments, ...fields } = payload;
  const hasFiles = Boolean(correctiveAttachments?.length);
  const body = hasFiles ? new FormData() : JSON.stringify(fields);

  if (body instanceof FormData) {
    if (fields.status) {
      body.set("status", fields.status);
    }

    if (fields.priority) {
      body.set("priority", fields.priority);
    }

    if (fields.correctiveActions !== undefined) {
      body.set("correctiveActions", fields.correctiveActions);
    }

    if (fields.n1 !== undefined) {
      body.set("n1", String(fields.n1));
    }

    correctiveAttachments?.forEach((attachment) => {
      body.append("correctiveAttachments", attachment);
    });
  }

  const data = await apiFetch<BackendIncident>(`/incidents/${id}`, {
    method: "PATCH",
    body,
  });

  return mapIncident(data);
}

/** Evidência depois de aberto o chamado (até 5 imagens por envio). */
export async function addIncidentAttachments(id: number, files: File[]) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("attachments", file);
  });

  const data = await apiFetch<BackendIncident>(`/incidents/${id}/attachments`, {
    method: "POST",
    body: formData,
  });

  return mapIncident(data);
}

/** Exclusão lógica, com o motivo; o admin pode restaurar. */
export async function deleteIncident(id: number, reason: string) {
  return apiFetch<{ message: string }>(`/incidents/${id}/delete`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function restoreIncident(id: number) {
  const data = await apiFetch<BackendIncident>(`/incidents/${id}/restore`, {
    method: "POST",
  });

  return mapIncident(data);
}

export async function addIncidentComment(id: number, message: string) {
  const data = await apiFetch<BackendIncident>(`/incidents/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  return mapIncident(data);
}

/** O que cada criticidade quer dizer e o prazo de primeira resposta. */
export async function fetchSlaRules() {
  return apiFetch<SlaRule[]>("/incidents/sla-rules");
}

export async function fetchNotifications() {
  return apiFetch<NotificationList>("/notifications");
}

/** Sem incidentId, marca todos os avisos como lidos. */
export async function markNotificationsRead(incidentId?: number) {
  return apiFetch<{ unreadCount: number }>("/notifications/read", {
    method: "POST",
    body: JSON.stringify(incidentId ? { incidentId } : {}),
  });
}

export async function createPreventiveAction(payload: {
  description: string;
  incidentId?: number;
}) {
  return apiFetch<{
    id: number;
    description: string;
    incidentId?: number | null;
    createdAt: string;
    updatedAt: string;
    incident?: {
      id: number;
      title: string;
    } | null;
  }>("/incidents/preventive-actions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: { email: string; password: string }) {
  return apiFetch<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAccount() {
  return apiFetch<AccountProfile>("/account");
}

export async function updateAccount(payload: { name: string }) {
  return apiFetch<AccountProfile>("/account", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Troca a senha; a rota do Next grava o token novo desta sessão. */
export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiFetch<AuthSession>("/account/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCompanies(query: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: "active" | "disabled";
}) {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);

  return apiFetch<CompanyListPage>(
    `/companies${params.size ? `?${params.toString()}` : ""}`,
  );
}

export async function fetchCompany(id: number) {
  return apiFetch<Company>(`/companies/${id}`);
}

export async function createCompany(payload: { name: string; cnpj?: string }) {
  return apiFetch<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** CNPJ vazio tira o CNPJ da empresa. */
export async function updateCompany(
  id: number,
  payload: { name?: string; cnpj?: string },
) {
  return apiFetch<Company>(`/companies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setCompanyDisabled(id: number, disabled: boolean) {
  return apiFetch<Company>(
    `/companies/${id}/${disabled ? "disable" : "enable"}`,
    { method: "POST" },
  );
}

export async function fetchCompanyUsers(companyId: number) {
  return apiFetch<CompanyUser[]>(`/companies/${companyId}/users`);
}

/** A senha temporária só vem nesta resposta. */
export async function createCompanyUser(
  companyId: number,
  payload: { name: string; email: string },
) {
  return apiFetch<{ user: CompanyUser; temporaryPassword: string }>(
    `/companies/${companyId}/users`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateCompanyUser(
  companyId: number,
  userId: number,
  payload: { name?: string; email?: string },
) {
  return apiFetch<CompanyUser>(`/companies/${companyId}/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** A senha temporária só vem nesta resposta. */
export async function resetCompanyUserPassword(
  companyId: number,
  userId: number,
) {
  return apiFetch<{ temporaryPassword: string }>(
    `/companies/${companyId}/users/${userId}/password-reset`,
    { method: "POST" },
  );
}

export async function setCompanyUserDisabled(
  companyId: number,
  userId: number,
  disabled: boolean,
) {
  return apiFetch<CompanyUser>(
    `/companies/${companyId}/users/${userId}/${disabled ? "disable" : "enable"}`,
    { method: "POST" },
  );
}

export async function fetchWebhookKeys(companyId: number) {
  return apiFetch<WebhookKey[]>(`/companies/${companyId}/webhook-keys`);
}

/** A chave completa só vem nesta resposta. */
export async function createWebhookKey(companyId: number, name: string) {
  return apiFetch<WebhookKey & { key: string }>(
    `/companies/${companyId}/webhook-keys`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export async function revokeWebhookKey(companyId: number, keyId: number) {
  return apiFetch<WebhookKey>(
    `/companies/${companyId}/webhook-keys/${keyId}`,
    { method: "DELETE" },
  );
}
