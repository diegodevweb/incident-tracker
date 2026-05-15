import type {
  ClientAccount,
  DashboardSummary,
  Incident,
  MonthlyReport,
  SlaRule,
  UserProfile,
} from "./types";

export const mockIncidents: Incident[] = [
  {
    id: 101,
    title: "Falha na emissão de NF-e",
    description: "O emissor retornou NCM inexistente durante a autorização.",
    correctiveActions:
      "Reprocessamento das regras fiscais com correção do NCM inválido e nova validação da emissão.",
    status: "RESOLVED",
    priority: "CRITICAL",
    source: "WEBHOOK",
    environment: "production",
    clientName: "Atacado Delta",
    createdAt: "2026-04-29T15:30:00.000Z",
    logs: [
      {
        id: 1,
        message: "[778] Rejeição: Informado NCM inexistente [nItem:1]",
        level: "ERROR",
        occurredAt: "2026-04-29T15:30:00.000Z",
        metadata: {
          file: "InvoiceController.php",
          line: 120,
        },
      },
    ],
    attachments: [
      {
        id: 11,
        filename: "nfe-validada.png",
        mimeType: "image/png",
        url: "#",
        category: "CORRECTIVE_ACTION",
      },
    ],
    events: [
      {
        id: 1001,
        type: "INCIDENT_CREATED",
        createdAt: "2026-04-29T15:30:00.000Z",
        actorName: "Monitor fiscal",
      },
      {
        id: 1002,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-29T15:42:00.000Z",
        actorName: "Analista N1",
        metadata: {
          fromStatus: "OPEN",
          toStatus: "PENDING",
        },
      },
      {
        id: 1003,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-29T16:05:00.000Z",
        actorName: "Analista N2",
        metadata: {
          fromStatus: "PENDING",
          toStatus: "IN_PROGRESS",
        },
      },
      {
        id: 1004,
        type: "CORRECTIVE_ACTION_ADDED",
        createdAt: "2026-04-29T17:40:00.000Z",
        actorName: "Analista N2",
        metadata: {
          description:
            "Reprocessamento das regras fiscais com correção do NCM inválido e nova validação da emissão.",
        },
      },
      {
        id: 1005,
        type: "ATTACHMENT_ADDED",
        createdAt: "2026-04-29T17:45:00.000Z",
        actorName: "Analista N2",
        metadata: {
          filename: "nfe-validada.png",
        },
      },
      {
        id: 1006,
        type: "INCIDENT_RESOLVED",
        createdAt: "2026-04-29T18:00:00.000Z",
        actorName: "Analista N2",
      },
    ],
  },
  {
    id: 102,
    title: "Checkout intermitente no painel do cliente",
    description: "Cliente relata timeout ao confirmar pedido pelo painel.",
    status: "IN_PROGRESS",
    priority: "ERROR",
    source: "DASHBOARD",
    environment: "production",
    clientName: "Atacado Delta",
    createdAt: "2026-04-28T20:12:00.000Z",
    logs: [
      {
        id: 2,
        message: "Gateway demorou além do limite configurado",
        level: "WARNING",
        occurredAt: "2026-04-28T20:12:00.000Z",
      },
    ],
    attachments: [
      {
        id: 1,
        filename: "checkout-timeout.png",
        mimeType: "image/png",
        url: "#",
      },
    ],
    events: [
      {
        id: 2001,
        type: "INCIDENT_CREATED",
        createdAt: "2026-04-28T20:12:00.000Z",
        actorName: "Cliente",
      },
      {
        id: 2002,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-28T20:25:00.000Z",
        actorName: "Suporte",
        metadata: {
          fromStatus: "OPEN",
          toStatus: "PENDING",
        },
      },
      {
        id: 2003,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-28T21:10:00.000Z",
        actorName: "Suporte",
        metadata: {
          fromStatus: "PENDING",
          toStatus: "IN_PROGRESS",
        },
      },
      {
        id: 2004,
        type: "LOG_REGISTERED",
        createdAt: "2026-04-28T21:12:00.000Z",
        actorName: "Monitor de aplicação",
        metadata: {
          message: "Gateway demorou além do limite configurado",
        },
      },
    ],
  },
  {
    id: 104,
    title: "Checkout intermitente",
    description: "Time interno monitora falha parcial reportada por outro cliente.",
    status: "OPEN",
    priority: "WARNING",
    source: "DASHBOARD",
    environment: "production",
    clientName: "Clube Sigma",
    createdAt: "2026-04-26T13:12:00.000Z",
    logs: [
      {
        id: 4,
        message: "Fila de autorização com aumento de latência",
        level: "WARNING",
        occurredAt: "2026-04-26T13:12:00.000Z",
      },
    ],
    attachments: [],
    events: [
      {
        id: 4001,
        type: "INCIDENT_CREATED",
        createdAt: "2026-04-26T13:12:00.000Z",
        actorName: "Operação interna",
      },
    ],
  },
  {
    id: 103,
    title: "Webhook sem autenticação",
    description: "Tentativas rejeitadas por ausência de API key.",
    correctiveActions:
      "API key regenerada, variável sincronizada no ambiente de homologação e novo teste executado com sucesso.",
    status: "RESOLVED",
    priority: "INFO",
    source: "WEBHOOK",
    environment: "staging",
    clientName: "Laboratório Aurora",
    createdAt: "2026-04-27T09:05:00.000Z",
    logs: [
      {
        id: 3,
        message: "API key ausente no header x-api-key",
        level: "INFO",
        occurredAt: "2026-04-27T09:05:00.000Z",
      },
    ],
    attachments: [
      {
        id: 31,
        filename: "webhook-auth-ok.png",
        mimeType: "image/png",
        url: "#",
        category: "CORRECTIVE_ACTION",
      },
    ],
    events: [
      {
        id: 3001,
        type: "INCIDENT_CREATED",
        createdAt: "2026-04-27T09:05:00.000Z",
        actorName: "Webhook monitor",
      },
      {
        id: 3002,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-27T09:20:00.000Z",
        actorName: "Suporte",
        metadata: {
          fromStatus: "OPEN",
          toStatus: "PENDING",
        },
      },
      {
        id: 3003,
        type: "STATUS_CHANGED",
        createdAt: "2026-04-27T09:45:00.000Z",
        actorName: "Suporte",
        metadata: {
          fromStatus: "PENDING",
          toStatus: "IN_PROGRESS",
        },
      },
      {
        id: 3004,
        type: "CORRECTIVE_ACTION_ADDED",
        createdAt: "2026-04-27T10:18:00.000Z",
        actorName: "Suporte",
        metadata: {
          description:
            "API key regenerada, variável sincronizada no ambiente de homologação e novo teste executado com sucesso.",
        },
      },
      {
        id: 3005,
        type: "ATTACHMENT_ADDED",
        createdAt: "2026-04-27T10:22:00.000Z",
        actorName: "Suporte",
        metadata: {
          filename: "webhook-auth-ok.png",
        },
      },
      {
        id: 3006,
        type: "INCIDENT_RESOLVED",
        createdAt: "2026-04-27T10:30:00.000Z",
        actorName: "Suporte",
      },
    ],
  },
];

export const dashboardSummary: DashboardSummary = {
  total: mockIncidents.length,
  open: mockIncidents.filter((incident) => incident.status === "OPEN").length,
  critical: mockIncidents.filter(
    (incident) => incident.priority === "CRITICAL",
  ).length,
  webhook: mockIncidents.filter((incident) => incident.source === "WEBHOOK")
    .length,
};

export const slaRules: SlaRule[] = [
  {
    priority: "CRITICAL",
    title: "Sistema indisponível ou emissão totalmente bloqueada",
    description: "Incidentes com impacto total na operação principal do cliente.",
    firstResponseTarget: "até 2h úteis",
  },
  {
    priority: "ERROR",
    title: "Emissão parcialmente bloqueada",
    description: "Falhas relevantes com impacto alto, mas ainda com operação parcial.",
    firstResponseTarget: "até 4h úteis",
  },
  {
    priority: "WARNING",
    title: "Erro com contorno operacional",
    description: "Problemas que exigem atenção, porém com fluxo alternativo possível.",
    firstResponseTarget: "até 1 dia útil",
  },
  {
    priority: "INFO",
    title: "Dúvidas ou ajustes simples",
    description: "Solicitações sem indisponibilidade e com baixo impacto operacional.",
    firstResponseTarget: "até 2 dias úteis",
  },
];

export const monthlyReport: MonthlyReport = {
  monthLabel: "Abril/2026",
  generatedAt: "2026-04-29T18:00:00.000Z",
  periodStart: "2026-04-01T00:00:00.000Z",
  periodEnd: "2026-04-30T23:59:59.999Z",
  slaRules,
  entries: mockIncidents.map((incident) => {
    const createdAt = new Date(incident.createdAt);
    const slaTarget =
      slaRules.find((rule) => rule.priority === incident.priority)
        ?.firstResponseTarget ?? "não definido";

    return {
      incidentId: incident.id,
      year: createdAt.getUTCFullYear(),
      month: createdAt.toLocaleString("pt-BR", {
        month: "long",
        timeZone: "UTC",
      }),
      day: createdAt.toLocaleString("pt-BR", {
        weekday: "long",
        timeZone: "UTC",
      }),
      date: createdAt.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
      time: createdAt.toLocaleTimeString("pt-BR", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      minute: createdAt.toLocaleTimeString("pt-BR", {
        timeZone: "UTC",
        minute: "2-digit",
      }),
      second: createdAt.toLocaleTimeString("pt-BR", {
        timeZone: "UTC",
        second: "2-digit",
      }),
      errorType: incident.priority,
      source: incident.source,
      slaTarget,
      priority: incident.priority,
      description: incident.description,
      title: incident.title,
      status: incident.status,
      clientName: incident.clientName,
      latestLogMessage: incident.logs[0]?.message ?? null,
    };
  }),
  correctiveActions: [
    {
      incidentId: 101,
      title: "Falha na emissão de NF-e",
      description: "Ajuste de regras de validação fiscal para prevenir rejeições de NCM.",
      status: "RESOLVED",
      createdAt: "2026-04-29T18:00:00.000Z",
      attachments: [],
    },
  ],
  preventiveActions: [
    {
      id: 1,
      description: "Checklist mensal de credenciais e webhooks ativos.",
      incidentId: 103,
      incidentTitle: "Webhook sem autenticação",
      createdAt: "2026-04-29T18:00:00.000Z",
    },
    {
      id: 2,
      description: "Revisão preventiva do emissor fiscal antes de virada de versão.",
      createdAt: "2026-04-28T18:00:00.000Z",
    },
  ],
  technicalIndicators: [
    {
      label: "Incidentes atendidos",
      value: String(mockIncidents.length),
      status: "ATTENDED",
    },
    {
      label: "Percentual críticos",
      value: "33%",
      status: "IN_PROGRESS",
    },
    {
      label: "Tempo médio de primeira resposta",
      value: "1h42",
      status: "ATTENDED",
    },
    {
      label: "Origem via webhook",
      value: "67%",
      status: "PENDING",
    },
  ],
};

export const mockProfiles: Record<"ADMIN" | "CLIENT", UserProfile> = {
  ADMIN: {
    id: 1,
    role: "ADMIN",
    fullName: "Diego Rodrigues",
    email: "diego.devwebb@gmail.com",
    phone: "(11) 99876-2211",
    companyName: "Webb Tecnologia",
    document: "12.345.678/0001-55",
    plan: "Operação avançada",
    preferredContact: "E-mail",
  },
  CLIENT: {
    id: 2,
    role: "CLIENT",
    fullName: "Marcos Vieira",
    email: "marcos.vieira@atacadodelta.com.br",
    phone: "(31) 98888-1122",
    companyName: "Atacado Delta",
    document: "44.555.666/0001-90",
    plan: "Suporte monitorado",
    preferredContact: "WhatsApp + e-mail",
  },
};

export const mockClients: ClientAccount[] = [
  {
    id: 101,
    companyName: "Atacado Delta",
    contactName: "Marcos Vieira",
    email: "marcos.vieira@atacadodelta.com.br",
    phone: "(31) 98888-1122",
    environment: "production",
    activeIncidents: 1,
    slaPlan: "Crítico 2h / Alta 4h",
  },
  {
    id: 102,
    companyName: "Clube Sigma",
    contactName: "Fernanda Costa",
    email: "fernanda.costa@clubesigma.com",
    phone: "(21) 97777-4433",
    environment: "production",
    activeIncidents: 1,
    slaPlan: "Operação contínua",
  },
  {
    id: 103,
    companyName: "Laboratório Aurora",
    contactName: "Bianca Souza",
    email: "bianca.souza@aurora.lab",
    phone: "(41) 96666-7788",
    environment: "staging",
    activeIncidents: 0,
    slaPlan: "Monitoramento homologação",
  },
];
