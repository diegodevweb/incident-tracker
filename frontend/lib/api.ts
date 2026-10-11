import type {
  AccountProfile,
  AuthSession,
  ClientAccount,
  ClientListPage,
  Incident,
  IncidentEnvironment,
  IncidentEvent,
  IncidentLevel,
  IncidentListPage,
  IncidentListSummary,
  IncidentSource,
  IncidentStatus,
  MonthlyReport,
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
  clientId: number;
  client: {
    id: number;
    name: string;
    email: string;
  };
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
    clientName: incident.client.name,
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

export async function fetchMonthlyReport(startDate: string, endDate: string, clientId?: number) {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  if (clientId) {
    params.set("clientId", String(clientId));
  }

  return apiFetch<MonthlyReport>(`/incidents/reports/monthly?${params.toString()}`);
}

export async function createIncident(payload: {
  clientId?: number;
  title: string;
  description: string;
  environment: IncidentEnvironment;
  priority: IncidentLevel;
  attachments?: File[];
}) {
  const formData = new FormData();
  if (payload.clientId) {
    formData.set("clientId", String(payload.clientId));
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
    correctiveActions?: string;
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

    if (fields.correctiveActions !== undefined) {
      body.set("correctiveActions", fields.correctiveActions);
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

export async function fetchClients(query: { page?: number; q?: string }) {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.q) params.set("q", query.q);

  return apiFetch<ClientListPage>(
    `/clients${params.size ? `?${params.toString()}` : ""}`,
  );
}

/** A senha temporária só vem nesta resposta. */
export async function createClient(payload: { name: string; email: string }) {
  return apiFetch<{ client: ClientAccount; temporaryPassword: string }>(
    "/clients",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateClient(
  id: number,
  payload: { name?: string; email?: string },
) {
  return apiFetch<ClientAccount>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** A senha temporária só vem nesta resposta. */
export async function resetClientPassword(id: number) {
  return apiFetch<{ temporaryPassword: string }>(
    `/clients/${id}/password-reset`,
    { method: "POST" },
  );
}

export async function setClientDisabled(id: number, disabled: boolean) {
  return apiFetch<ClientAccount>(
    `/clients/${id}/${disabled ? "disable" : "enable"}`,
    { method: "POST" },
  );
}
