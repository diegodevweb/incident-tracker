import type {
  AuthSession,
  Incident,
  IncidentEnvironment,
  IncidentEvent,
  IncidentLevel,
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
  attachments: {
    id: number;
    filename: string;
    mimeType: string;
    url: string;
    category?: "GENERAL" | "CORRECTIVE_ACTION";
  }[];
  logs: {
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

function getApiBaseUrl() {
  return "/api";
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
    const text = await response.text();
    throw new Error(text || `Erro ao consumir API: ${response.status}`);
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
    attachments: incident.attachments,
    logs: incident.logs.map((log) => ({
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

export async function fetchIncidents(query?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const data = await apiFetch<BackendIncident[]>(
    `/incidents${params.size ? `?${params.toString()}` : ""}`,
  );

  return data.map(mapIncident);
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
    correctiveActionAttachments?: File[];
  },
) {
  const hasFiles = Boolean(payload.correctiveActionAttachments?.length);
  const body = hasFiles ? new FormData() : JSON.stringify(payload);

  if (body instanceof FormData) {
    if (payload.status) {
      body.set("status", payload.status);
    }

    if (payload.correctiveActions !== undefined) {
      body.set("correctiveActions", payload.correctiveActions);
    }

    payload.correctiveActionAttachments?.forEach((attachment) => {
      body.append("correctiveActionAttachments", attachment);
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
