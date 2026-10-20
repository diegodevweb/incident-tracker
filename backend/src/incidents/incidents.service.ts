import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttachmentCategory,
  IncidentAttachment,
  IncidentEventType,
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { ListErrorLogsQueryDto } from './dto/list-error-logs-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreatePreventiveActionDto } from './dto/create-preventive-action.dto';
import { CreateIncidentCommentDto } from './dto/create-incident-comment.dto';
import { DeleteIncidentDto } from './dto/delete-incident.dto';
import { StorageService } from '../storage/storage.types';
import { detectImageType } from '../storage/detect-image-type';
import { truncateFilename } from './filenames';
import { MAX_VARCHAR_LENGTH } from './limits';
import {
  DEFAULT_ERROR_LOGS_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_REPORT_RANGE_DAYS,
} from './pagination';
import { PUBLIC_COMPANY_SELECT, PUBLIC_USER_SELECT } from './public-selects';
import {
  INCIDENT_EVENTS_QUERY,
  attachmentAddedEvents,
  incidentUpdateEvents,
  toPublicIncidentEvent,
} from './incident-events';
import {
  INCIDENT_COMMENTS_QUERY,
  toPublicIncidentComment,
} from './incident-comments';
import {
  type IncidentNotice,
  noticesForIncidentUpdate,
} from './incident-notifications';
import {
  FIRST_RESPONSE_TARGET_LABEL,
  type SlaIncident,
  firstResponseSla,
  responseSla,
} from './sla';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import type { AuthenticatedWebhookKey } from '../webhook-keys/webhook-keys.service';

type UploadedAttachment = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

// O detalhe do chamado: ler, criar, editar, anexar e comentar devolvem o mesmo formato.
const INCIDENT_DETAIL_INCLUDE = {
  company: { select: PUBLIC_COMPANY_SELECT },
  createdBy: { select: PUBLIC_USER_SELECT },
  deletedBy: { select: PUBLIC_USER_SELECT },
  attachments: true,
  logs: { orderBy: { occurredAt: 'desc' } },
  events: INCIDENT_EVENTS_QUERY,
  comments: INCIDENT_COMMENTS_QUERY,
} satisfies Prisma.IncidentInclude;

type IncidentDetailRow = Prisma.IncidentGetPayload<{
  include: typeof INCIDENT_DETAIL_INCLUDE;
}>;

const SLA_SELECT = {
  createdAt: true,
  priority: true,
  status: true,
  firstRespondedAt: true,
  responsePriority: true,
  reopenedAt: true,
  reopenRespondedAt: true,
  reopenResponsePriority: true,
  n1ClassifiedAt: true,
} satisfies Prisma.IncidentSelect;

// O relatório mensal vale como documento para o cliente: datas, horas e a
// competência saem no horário de Brasília, o mesmo do SLA. Em UTC, um chamado
// das 22h do último dia do mês caía no mês seguinte.
const REPORT_TIME_ZONE = 'America/Sao_Paulo';

// O prazo que corre agora: o da reabertura, se houve; nulo nos N1.
const withSla = <T extends SlaIncident>(incident: T, now = new Date()) => ({
  ...incident,
  sla: responseSla(incident, now),
});

// Entram os chamados que já têm resultado (respondidos e vencidos sem
// resposta), menos os abertos pela equipe, que nascem respondidos, e os N1,
// que não são atendidos pela equipe.
const firstResponseOnTimeRate = (incidents: SlaIncident[], now: Date) => {
  const states = incidents
    .filter(
      (incident) =>
        !incident.n1ClassifiedAt &&
        incident.firstRespondedAt?.getTime() !== incident.createdAt.getTime(),
    )
    .map((incident) => firstResponseSla(incident, now).state)
    .filter(
      (state) => state === 'MET' || state === 'MISSED' || state === 'BREACHED',
    );

  if (!states.length) {
    return '-';
  }

  const met = states.filter((state) => state === 'MET').length;

  return `${Math.round((met / states.length) * 100)}%`;
};

const toCounts = <K extends string>(
  keys: readonly K[],
  rows: { value: K; count: number }[],
) =>
  Object.fromEntries(
    keys.map((key) => [key, rows.find((row) => row.value === key)?.count ?? 0]),
  ) as Record<K, number>;

// O cliente exclui o que ele mesmo abriu enquanto a equipe não fez nada nele:
// nenhuma mensagem e nenhum evento de admin (status, criticidade, solução, N1).
const clientMayDelete = (
  incident: {
    createdById: number | null;
    events: { actor: { role: UserRole } | null }[];
    comments: { author: { role: UserRole } }[];
  },
  user: JwtPayload,
) =>
  incident.createdById === user.sub &&
  !incident.events.some((event) => event.actor?.role === UserRole.ADMIN) &&
  !incident.comments.some((comment) => comment.author.role === UserRole.ADMIN);

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private readonly slaRules = (
    Object.entries(FIRST_RESPONSE_TARGET_LABEL) as [IncidentLevel, string][]
  ).map(([priority, firstResponseTarget]) => ({
    priority,
    firstResponseTarget,
    title:
      priority === IncidentLevel.CRITICAL
        ? 'Sistema indisponível ou emissão totalmente bloqueada'
        : priority === IncidentLevel.ERROR
          ? 'Emissão parcialmente bloqueada'
          : priority === IncidentLevel.WARNING
            ? 'Erro com contorno operacional'
            : 'Dúvidas ou ajustes simples',
    description:
      priority === IncidentLevel.CRITICAL
        ? 'Incidentes com impacto total na operação principal do cliente.'
        : priority === IncidentLevel.ERROR
          ? 'Falhas relevantes com impacto alto, mas ainda com operação parcial.'
          : priority === IncidentLevel.WARNING
            ? 'Problemas que exigem atenção, porém com fluxo alternativo possível.'
            : 'Solicitações sem indisponibilidade e com baixo impacto operacional.',
  }));

  /** O que cada criticidade quer dizer e o prazo de primeira resposta. */
  getSlaRules() {
    return this.slaRules;
  }

  private buildPeriodLabel(startDate: Date, endDate: Date) {
    const monthOf = (date: Date) =>
      date.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: REPORT_TIME_ZONE,
      });

    if (monthOf(startDate) === monthOf(endDate)) {
      return monthOf(startDate);
    }

    return `${startDate.toLocaleDateString('pt-BR', {
      timeZone: REPORT_TIME_ZONE,
    })} a ${endDate.toLocaleDateString('pt-BR', {
      timeZone: REPORT_TIME_ZONE,
    })}`;
  }

  async getIncidents(query: ListIncidentsQueryDto, user: JwtPayload) {
    if (query.deleted && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores veem os chamados excluídos',
      );
    }

    const where: Prisma.IncidentWhereInput = {
      deletedAt: query.deleted ? { not: null } : null,
      ...(query.n1 !== undefined
        ? { n1ClassifiedAt: query.n1 ? { not: null } : null }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.environment ? { environment: query.environment } : {}),
      ...this.buildScopedCompanyFilter(user, query.companyId),
      ...(query.company
        ? {
            company: {
              name: {
                contains: query.company,
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                title: {
                  contains: query.q,
                },
              },
              {
                description: {
                  contains: query.q,
                },
              },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const [items, total, byStatus, byPriority, bySource, awaitingResponse] =
      await Promise.all([
        this.prisma.incident.findMany({
          where,
          // A lista não usa logs nem anexos: ficam só no detalhe, que também assina as URLs.
          include: {
            company: { select: PUBLIC_COMPANY_SELECT },
            createdBy: { select: PUBLIC_USER_SELECT },
            deletedBy: { select: PUBLIC_USER_SELECT },
          },
          // O id desempata createdAt iguais para uma página não repetir nem pular linhas.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.incident.count({ where }),
        this.prisma.incident.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.incident.groupBy({
          by: ['priority'],
          where,
          _count: { _all: true },
        }),
        this.prisma.incident.groupBy({
          by: ['source'],
          where,
          _count: { _all: true },
        }),
        // O SLA depende do expediente, que o banco não sabe contar: os que
        // esperam resposta vêm para cá. São só a fila sem resposta, não o
        // histórico: sem a primeira resposta ou sem a resposta à reabertura.
        this.prisma.incident.findMany({
          where: {
            AND: [
              where,
              {
                status: { not: IncidentStatus.RESOLVED },
                n1ClassifiedAt: null,
                OR: [
                  { reopenedAt: null, firstRespondedAt: null },
                  { reopenedAt: { not: null }, reopenRespondedAt: null },
                ],
              },
            ],
          },
          select: SLA_SELECT,
        }),
      ]);

    const now = new Date();
    const awaitingStates = awaitingResponse.map(
      (incident) => responseSla(incident, now)?.state,
    );

    return {
      items: items.map((incident) => withSla(incident, now)),
      page,
      pageSize,
      total,
      // Contagens do conjunto filtrado inteiro, não só da página.
      summary: {
        byStatus: toCounts(
          Object.values(IncidentStatus),
          byStatus.map((row) => ({
            value: row.status,
            count: row._count._all,
          })),
        ),
        byPriority: toCounts(
          Object.values(IncidentLevel),
          byPriority.map((row) => ({
            value: row.priority,
            count: row._count._all,
          })),
        ),
        bySource: toCounts(
          Object.values(IncidentSource),
          bySource.map((row) => ({
            value: row.source,
            count: row._count._all,
          })),
        ),
        sla: {
          breached: awaitingStates.filter((state) => state === 'BREACHED')
            .length,
          atRisk: awaitingStates.filter((state) => state === 'AT_RISK').length,
        },
      },
    };
  }

  async createIncident(
    data: CreateIncidentDto,
    attachments: UploadedAttachment[] = [],
    user: JwtPayload,
  ) {
    if (data.status && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores podem definir o status ao criar um chamado',
      );
    }

    // A empresa é conferida antes do upload: um 400 aqui não deixa arquivo órfão.
    const companyId = await this.resolveCompanyId(user, data.companyId);

    if (user.role !== UserRole.ADMIN) {
      this.assertClientEvidence(data, attachments.length);
    }

    const generalAttachments = await this.uploadAttachments(
      attachments,
      AttachmentCategory.GENERAL,
    );

    const status = data.status ?? IncidentStatus.OPEN;
    const priority = data.priority ?? IncidentLevel.ERROR;
    const createdAt = new Date();

    const incident = await this.withUploadCleanup(generalAttachments, () =>
      this.prisma.incident.create({
        data: {
          title: data.title,
          description: data.description,
          status,
          priority,
          createdAt,
          // Quando é a equipe que abre, o chamado já nasce respondido.
          ...(user.role === UserRole.ADMIN
            ? { firstRespondedAt: createdAt, responsePriority: priority }
            : {}),
          source: IncidentSource.DASHBOARD,
          environment: data.environment,
          companyId,
          createdById: user.sub,
          logs: {
            create: {
              message: data.description,
              level: priority,
              occurredAt: new Date(),
            },
          },
          ...(generalAttachments.length
            ? {
                attachments: {
                  create: generalAttachments,
                },
              }
            : {}),
          events: {
            create: [
              {
                type: IncidentEventType.INCIDENT_CREATED,
                actorId: user.sub,
                metadata: { status },
              },
              ...attachmentAddedEvents(generalAttachments, user.sub),
            ],
          },
        },
        include: INCIDENT_DETAIL_INCLUDE,
      }),
    );

    return {
      message: 'Ticket criado com sucesso',
      data: await this.presentIncidentDetail(incident, user),
    };
  }

  // O admin abre um chamado excluído (para ver o que vai restaurar); para o
  // cliente ele não existe mais.
  async getIncident(id: number, user: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: INCIDENT_DETAIL_INCLUDE,
    });

    if (!incident || (incident.deletedAt && user.role !== UserRole.ADMIN)) {
      throw new NotFoundException(`Incidente não encontrado para o ID ${id}`);
    }

    this.assertIncidentAccess(incident.companyId, user);

    return this.presentIncidentDetail(incident, user);
  }

  async getMonthlyReport(query: MonthlyReportQueryDto, user: JwtPayload) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    this.assertReportRange(startDate, endDate);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
        ...this.buildScopedCompanyFilter(user, query.companyId),
      },
      include: {
        company: { select: PUBLIC_COMPANY_SELECT },
        // O relatório só usa os anexos das ações corretivas e o último log.
        attachments: {
          where: { category: AttachmentCategory.CORRECTIVE_ACTION },
        },
        logs: {
          orderBy: {
            occurredAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const incidentsWithAttachmentUrls = await Promise.all(
      incidents.map(async (incident) =>
        incident.correctiveActions
          ? await this.resolveIncidentAttachmentUrls(incident)
          : incident,
      ),
    );

    const now = new Date();
    const entries = incidentsWithAttachmentUrls.map((incident) => {
      const createdAt = incident.createdAt;
      const latestLog = incident.logs[0];
      const sla = firstResponseSla(incident, now);
      const n1 = Boolean(incident.n1ClassifiedAt);

      return {
        incidentId: incident.id,
        title: incident.title,
        createdAt: createdAt.toISOString(),
        year: Number(
          createdAt.toLocaleString('pt-BR', {
            year: 'numeric',
            timeZone: REPORT_TIME_ZONE,
          }),
        ),
        month: createdAt.toLocaleString('pt-BR', {
          month: 'long',
          timeZone: REPORT_TIME_ZONE,
        }),
        day: createdAt.toLocaleString('pt-BR', {
          weekday: 'long',
          timeZone: REPORT_TIME_ZONE,
        }),
        date: createdAt.toLocaleDateString('pt-BR', {
          timeZone: REPORT_TIME_ZONE,
        }),
        time: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: REPORT_TIME_ZONE,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        minute: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: REPORT_TIME_ZONE,
          minute: '2-digit',
        }),
        second: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: REPORT_TIME_ZONE,
          second: '2-digit',
        }),
        errorType: incident.priority,
        source: incident.source,
        slaTarget: sla.target,
        // N1 fica fora do SLA da equipe: sem resultado de prazo.
        slaState: n1 ? null : sla.state,
        n1,
        priority: incident.priority,
        description: incident.description,
        status: incident.status,
        companyName: incident.company.name,
        latestLogMessage: latestLog?.message ?? null,
      };
    });

    const preventiveActions = await this.prisma.preventiveAction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        // A ação ligada a um chamado excluído sai junto com ele.
        OR: [{ incidentId: null }, { incident: { deletedAt: null } }],
      },
      include: {
        incident: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      monthLabel: this.buildPeriodLabel(startDate, endDate),
      generatedAt: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      slaRules: this.slaRules,
      entries,
      correctiveActions: incidentsWithAttachmentUrls
        .filter((incident) => incident.correctiveActions)
        .map((incident) => ({
          incidentId: incident.id,
          title: incident.title,
          description: incident.correctiveActions,
          status: incident.status,
          createdAt: incident.updatedAt.toISOString(),
          attachments: incident.attachments.filter(
            (attachment) =>
              attachment.category === AttachmentCategory.CORRECTIVE_ACTION,
          ),
        })),
      preventiveActions: preventiveActions.map((action) => ({
        id: action.id,
        description: action.description,
        incidentId: action.incidentId,
        incidentTitle: action.incident?.title ?? null,
        createdAt: action.createdAt.toISOString(),
      })),
      technicalIndicators: [
        {
          label: 'Primeira resposta no prazo',
          value: firstResponseOnTimeRate(incidentsWithAttachmentUrls, now),
          status: 'ATTENDED',
        },
        {
          label: 'Incidentes atendidos',
          value: String(incidentsWithAttachmentUrls.length),
          status: 'ATTENDED',
        },
        {
          label: 'Chamados N1 (fora do SLA)',
          value: String(
            incidentsWithAttachmentUrls.filter(
              (incident) => incident.n1ClassifiedAt,
            ).length,
          ),
          status: 'ATTENDED',
        },
        {
          label: 'Percentual críticos',
          value: incidentsWithAttachmentUrls.length
            ? `${Math.round(
                (incidentsWithAttachmentUrls.filter(
                  (incident) => incident.priority === IncidentLevel.CRITICAL,
                ).length /
                  incidentsWithAttachmentUrls.length) *
                  100,
              )}%`
            : '0%',
          status: 'ATTENDED',
        },
        {
          label: 'Origem via webhook',
          value: incidentsWithAttachmentUrls.length
            ? `${Math.round(
                (incidentsWithAttachmentUrls.filter(
                  (incident) => incident.source === IncidentSource.WEBHOOK,
                ).length /
                  incidentsWithAttachmentUrls.length) *
                  100,
              )}%`
            : '0%',
          status: 'ATTENDED',
        },
        {
          label: 'Chamados resolvidos',
          value: String(
            incidentsWithAttachmentUrls.filter(
              (incident) => incident.status === IncidentStatus.RESOLVED,
            ).length,
          ),
          status: 'IN_PROGRESS',
        },
      ],
    };
  }

  async updateIncident(
    id: number,
    data: UpdateIncidentDto,
    user: JwtPayload,
    correctiveAttachments: UploadedAttachment[] = [],
  ) {
    const current = await this.getIncident(id, user);

    this.assertNotDeleted(current);

    if (user.role !== UserRole.ADMIN) {
      this.assertClientUpdate(
        current.status,
        data,
        correctiveAttachments.length,
      );
    }

    const uploadedCorrectiveAttachments = await this.uploadAttachments(
      correctiveAttachments,
      AttachmentCategory.CORRECTIVE_ACTION,
    );
    const correctiveActions =
      data.correctiveActions !== undefined
        ? data.correctiveActions || null
        : undefined;
    // Gravados no mesmo update (escrita aninhada, numa transação só): não fica
    // mudança sem evento nem evento de mudança que falhou.
    const events = incidentUpdateEvents({
      current,
      status: data.status,
      priority: data.priority,
      correctiveActions,
      n1: data.n1,
      attachments: uploadedCorrectiveAttachments,
      actorId: user.sub,
    });
    const reopening =
      current.status === IncidentStatus.RESOLVED &&
      data.status !== undefined &&
      data.status !== IncidentStatus.RESOLVED;

    const incident = await this.withUploadCleanup(
      uploadedCorrectiveAttachments,
      async () =>
        this.prisma.incident.update({
          where: { id },
          data: {
            ...(data.status ? { status: data.status } : {}),
            ...(data.priority ? { priority: data.priority } : {}),
            ...(reopening
              ? this.reopeningWrite(current, user)
              : data.status && data.status !== current.status
                ? this.responseWrite(current, user)
                : {}),
            ...(data.n1 !== undefined &&
            data.n1 !== Boolean(current.n1ClassifiedAt)
              ? { n1ClassifiedAt: data.n1 ? new Date() : null }
              : {}),
            ...(correctiveActions !== undefined ? { correctiveActions } : {}),
            ...(uploadedCorrectiveAttachments.length
              ? { attachments: { create: uploadedCorrectiveAttachments } }
              : {}),
            ...(events.length ? { events: { create: events } } : {}),
            ...(await this.companyNoticesWrite(
              current.companyId,
              user,
              noticesForIncidentUpdate(events),
            )),
          },
          include: INCIDENT_DETAIL_INCLUDE,
        }),
    );

    return this.presentIncidentDetail(incident, user);
  }

  // Evidência depois de aberto o chamado, por qualquer um que veja o chamado.
  async addAttachments(
    id: number,
    attachments: UploadedAttachment[],
    user: JwtPayload,
  ) {
    if (!attachments.length) {
      throw new BadRequestException('Envie ao menos uma imagem');
    }

    await this.findAccessibleIncident(id, user);

    const uploaded = await this.uploadAttachments(
      attachments,
      AttachmentCategory.GENERAL,
    );

    const incident = await this.withUploadCleanup(uploaded, () =>
      this.prisma.incident.update({
        where: { id },
        data: {
          attachments: { create: uploaded },
          events: { create: attachmentAddedEvents(uploaded, user.sub) },
        },
        include: INCIDENT_DETAIL_INCLUDE,
      }),
    );

    return this.presentIncidentDetail(incident, user);
  }

  // O admin escreve quando quiser; o cliente responde depois que um admin
  // escreveu a primeira mensagem do chamado.
  async addComment(
    id: number,
    data: CreateIncidentCommentDto,
    user: JwtPayload,
  ) {
    const current = await this.findAccessibleIncident(id, user);

    if (user.role !== UserRole.ADMIN) {
      const adminMessages = await this.prisma.incidentComment.count({
        where: { incidentId: id, author: { role: UserRole.ADMIN } },
      });

      if (!adminMessages) {
        throw new ForbiddenException(
          'Você poderá responder depois da primeira resposta da equipe',
        );
      }
    }

    const incident = await this.prisma.incident.update({
      where: { id },
      data: {
        comments: { create: { authorId: user.sub, message: data.message } },
        ...this.responseWrite(current, user),
        ...(await this.companyNoticesWrite(current.companyId, user, [
          { type: NotificationType.COMMENT_ADDED },
        ])),
      },
      include: INCIDENT_DETAIL_INCLUDE,
    });

    return this.presentIncidentDetail(incident, user);
  }

  // Exclusão lógica: o chamado sai das listas, do relatório e dos avisos, e o
  // admin pode restaurar. O admin exclui qualquer um; o cliente, só o que ele
  // mesmo abriu e em que a equipe ainda não fez nada.
  async deleteIncident(id: number, data: DeleteIncidentDto, user: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: {
        companyId: true,
        createdById: true,
        deletedAt: true,
        events: { select: { actor: { select: { role: true } } } },
        comments: { select: { author: { select: { role: true } } } },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incidente não encontrado para o ID ${id}`);
    }

    this.assertIncidentAccess(incident.companyId, user);
    this.assertNotDeleted(incident, user);

    if (user.role !== UserRole.ADMIN && !clientMayDelete(incident, user)) {
      throw new ForbiddenException(
        'Você só pode excluir chamados que você abriu e em que a equipe ainda não respondeu',
      );
    }

    const deleted = await this.prisma.incident.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user.sub,
        deletionReason: data.reason,
        events: {
          create: {
            type: IncidentEventType.INCIDENT_DELETED,
            actorId: user.sub,
            metadata: { reason: data.reason },
          },
        },
      },
      select: { id: true, deletedAt: true },
    });

    return { message: 'Chamado excluído', data: deleted };
  }

  async restoreIncident(id: number, user: JwtPayload) {
    const current = await this.prisma.incident.findUnique({
      where: { id },
      select: { deletedAt: true },
    });

    if (!current) {
      throw new NotFoundException(`Incidente não encontrado para o ID ${id}`);
    }

    if (!current.deletedAt) {
      throw new ConflictException('O chamado não está excluído');
    }

    const incident = await this.prisma.incident.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        events: {
          create: {
            type: IncidentEventType.INCIDENT_RESTORED,
            actorId: user.sub,
          },
        },
      },
      include: INCIDENT_DETAIL_INCLUDE,
    });

    return this.presentIncidentDetail(incident, user);
  }

  async createPreventiveAction(
    data: CreatePreventiveActionDto,
    user: JwtPayload,
  ) {
    if (data.incidentId) {
      this.assertNotDeleted(await this.getIncident(data.incidentId, user));
    }

    return this.prisma.preventiveAction.create({
      data: {
        description: data.description,
        incidentId: data.incidentId ?? null,
      },
      include: {
        incident: true,
      },
    });
  }

  // As rotas do webhook só enxergam os logs da empresa dona da chave.
  async getErrorLogs(query: ListErrorLogsQueryDto, companyId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_ERROR_LOGS_PAGE_SIZE;

    const incidentList = await this.prisma.incidentLog.findMany({
      where: { incident: { companyId, deletedAt: null } },
      include: {
        incident: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    if (!incidentList || incidentList.length === 0) {
      throw new NotFoundException('Nenhum registro encontrado');
    }

    return incidentList;
  }

  async getErrorLog(id: number, companyId: number) {
    const incidentLog = await this.prisma.incidentLog.findFirst({
      where: { id, incident: { companyId, deletedAt: null } },
      include: {
        incident: true,
      },
    });

    if (!incidentLog) {
      throw new NotFoundException(`Registro não encontrado para o ID ${id}`);
    }

    return incidentLog;
  }

  // A empresa vem da chave do webhook, nunca do corpo. Origem e status são
  // fixos: a integração só abre chamados, quem atende muda o status.
  async createErrorLog(
    data: CreateErrorLogDto,
    webhookKey: AuthenticatedWebhookKey,
  ) {
    const status = IncidentStatus.OPEN;

    const incidentLog = await this.prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        status,
        priority: data.priority ?? IncidentLevel.ERROR,
        source: IncidentSource.WEBHOOK,
        environment: data.environment,
        companyId: webhookKey.companyId,
        logs: {
          create: {
            message: data.message,
            level: data.level ?? IncidentLevel.ERROR,
            occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
            metadata: data.metadata ?? undefined,
          },
        },
        events: {
          // Sem autor: quem cria pelo webhook é a integração, não um usuário.
          // A chave usada fica registrada para rastrear o que ela criou.
          create: {
            type: IncidentEventType.INCIDENT_CREATED,
            actorId: null,
            metadata: { status, webhookKeyId: webhookKey.id },
          },
        },
      },
      include: {
        logs: true,
        company: { select: PUBLIC_COMPANY_SELECT },
      },
    });

    return {
      message: 'Erro cadastrado com sucesso',
      data: incidentLog,
    };
  }

  private assertReportRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException(
        'A data final deve ser igual ou posterior à data inicial',
      );
    }

    const maxRangeMs = MAX_REPORT_RANGE_DAYS * 24 * 60 * 60 * 1000;

    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      throw new BadRequestException(
        `O período do relatório não pode passar de ${MAX_REPORT_RANGE_DAYS} dias`,
      );
    }
  }

  // O cliente vê os chamados da empresa dele, de qualquer usuário e do webhook.
  private buildScopedCompanyFilter(
    user: JwtPayload,
    requestedCompanyId?: number,
  ) {
    if (user.role === UserRole.ADMIN) {
      return requestedCompanyId ? { companyId: requestedCompanyId } : {};
    }

    return { companyId: this.requireUserCompany(user) };
  }

  // O cliente abre sempre na própria empresa; o admin precisa escolher uma.
  private async resolveCompanyId(
    user: JwtPayload,
    requestedCompanyId?: number,
  ) {
    if (user.role !== UserRole.ADMIN) {
      return this.requireUserCompany(user);
    }

    if (!requestedCompanyId) {
      throw new BadRequestException('Informe a empresa do chamado');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: requestedCompanyId },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('Empresa não encontrada');
    }

    return company.id;
  }

  private async findAccessibleIncident(id: number, user: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        deletedAt: true,
        ...SLA_SELECT,
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incidente não encontrado para o ID ${id}`);
    }

    this.assertIncidentAccess(incident.companyId, user);
    this.assertNotDeleted(incident, user);

    return incident;
  }

  // Excluído não muda: o cliente nem o vê, e o admin restaura antes.
  private assertNotDeleted(
    incident: { deletedAt: Date | null },
    user?: JwtPayload,
  ) {
    if (!incident.deletedAt) {
      return;
    }

    if (user && user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Incidente não encontrado');
    }

    throw new ConflictException(
      'O chamado está excluído. Restaure-o antes de alterá-lo.',
    );
  }

  // O cliente confirma que o problema acabou (resolver) ou avisa que voltou
  // (reabrir um resolvido). Ação corretiva e os status de trabalho são do admin.
  private assertClientUpdate(
    currentStatus: IncidentStatus,
    data: UpdateIncidentDto,
    correctiveAttachmentCount: number,
  ) {
    if (data.correctiveActions !== undefined || correctiveAttachmentCount) {
      throw new ForbiddenException(
        'Apenas administradores registram ação corretiva',
      );
    }

    if (data.priority !== undefined) {
      throw new ForbiddenException(
        'Apenas administradores mudam a criticidade do chamado',
      );
    }

    if (data.n1 !== undefined) {
      throw new ForbiddenException(
        'Apenas administradores classificam o chamado como N1',
      );
    }

    if (!data.status || data.status === currentStatus) {
      return;
    }

    const resolving = data.status === IncidentStatus.RESOLVED;
    const reopening =
      currentStatus === IncidentStatus.RESOLVED &&
      data.status === IncidentStatus.OPEN;

    if (!resolving && !reopening) {
      throw new ForbiddenException(
        'Você pode marcar o chamado como resolvido ou reabrir um chamado resolvido',
      );
    }
  }

  // Quem abre o chamado pelo painel é quem mais sabe do problema: o cliente
  // escolhe a criticidade e manda ao menos um print. O admin abre em nome dele
  // e pode não ter as evidências na mão.
  private assertClientEvidence(
    data: CreateIncidentDto,
    attachmentCount: number,
  ) {
    if (!data.priority) {
      throw new BadRequestException('Informe a criticidade do chamado');
    }

    if (!attachmentCount) {
      throw new BadRequestException('Anexe ao menos um print do problema');
    }
  }

  // A mensagem ou mudança de status de um admin para o relógio que estiver
  // correndo: o da reabertura, se houve, ou o da primeira resposta. Resolvido,
  // o relógio já parou. Fica gravada a criticidade de antes desta edição: se o
  // admin muda a criticidade junto com a resposta, o prazo que vale é o que o
  // cliente via.
  private responseWrite(
    incident: SlaIncident,
    user: JwtPayload,
  ): Prisma.IncidentUpdateInput {
    if (
      user.role !== UserRole.ADMIN ||
      incident.status === IncidentStatus.RESOLVED
    ) {
      return {};
    }

    if (incident.reopenedAt) {
      return incident.reopenRespondedAt
        ? {}
        : {
            reopenRespondedAt: new Date(),
            reopenResponsePriority: incident.priority,
          };
    }

    return incident.firstRespondedAt
      ? {}
      : { firstRespondedAt: new Date(), responsePriority: incident.priority };
  }

  // Reabrir (de resolvido para outro status) começa um prazo novo. Quando é a
  // equipe que reabre, ele já nasce respondido, como o chamado que ela abre.
  private reopeningWrite(
    incident: SlaIncident,
    user: JwtPayload,
  ): Prisma.IncidentUpdateInput {
    const now = new Date();
    const byAdmin = user.role === UserRole.ADMIN;

    return {
      reopenedAt: now,
      reopenRespondedAt: byAdmin ? now : null,
      reopenResponsePriority: byAdmin ? incident.priority : null,
    };
  }

  // Avisa todos os usuários ativos da empresa, gravando junto com a mudança
  // (escrita aninhada). Só ação de admin avisa: o que o cliente fez ele já sabe.
  private async companyNoticesWrite(
    companyId: number,
    user: JwtPayload,
    notices: IncidentNotice[],
  ): Promise<Pick<Prisma.IncidentUpdateInput, 'notifications'>> {
    if (user.role !== UserRole.ADMIN || !notices.length) {
      return {};
    }

    const recipients = await this.prisma.user.findMany({
      where: { companyId, role: UserRole.CLIENT, disabledAt: null },
      select: { id: true },
    });

    if (!recipients.length) {
      return {};
    }

    return {
      notifications: {
        createMany: {
          data: recipients.flatMap(({ id: userId }) =>
            notices.map((notice) => ({ userId, ...notice })),
          ),
        },
      },
    };
  }

  private assertIncidentAccess(companyId: number, user: JwtPayload) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (companyId !== this.requireUserCompany(user)) {
      throw new NotFoundException('Incidente não encontrado');
    }
  }

  // O JwtStrategy já barra cliente sem empresa; isto só garante que um token
  // sem companyId nunca vire um filtro vazio (que mostraria tudo).
  private requireUserCompany(user: JwtPayload) {
    if (!user.companyId) {
      throw new ForbiddenException('Usuário sem empresa');
    }

    return user.companyId;
  }

  private async uploadAttachments(
    attachments: UploadedAttachment[],
    category: AttachmentCategory,
  ) {
    // Valida todos os arquivos antes de enviar qualquer um ao storage.
    const detectedTypes = attachments.map((attachment) => {
      const detectedType = detectImageType(attachment.buffer);

      if (!detectedType) {
        throw new UnsupportedMediaTypeException(
          `O arquivo "${attachment.originalname}" não é um tipo permitido. Envie imagens PNG ou JPEG.`,
        );
      }

      return detectedType;
    });

    const results = await Promise.allSettled(
      attachments.map(async (attachment, index) => {
        const key = this.buildAttachmentKey(attachment.originalname);
        const uploadedAttachment = await this.storageService.uploadObject({
          key,
          body: attachment.buffer,
          contentType: detectedTypes[index].mime,
        });

        return {
          filename: truncateFilename(
            attachment.originalname,
            MAX_VARCHAR_LENGTH,
          ),
          mimeType: detectedTypes[index].mime,
          url: uploadedAttachment.key,
          category,
        };
      }),
    );

    const uploaded = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failure = results.find((result) => result.status === 'rejected');

    if (failure) {
      await this.deleteUploadedObjects(uploaded);
      throw failure.reason;
    }

    return uploaded;
  }

  private async withUploadCleanup<T>(
    uploaded: { url: string }[],
    operation: () => Promise<T>,
  ) {
    try {
      return await operation();
    } catch (error) {
      await this.deleteUploadedObjects(uploaded);
      throw error;
    }
  }

  private async deleteUploadedObjects(uploaded: { url: string }[]) {
    const results = await Promise.allSettled(
      uploaded.map((attachment) =>
        this.storageService.deleteObject(attachment.url),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Não foi possível remover o objeto órfão ${uploaded[index].url}`,
        );
      }
    });
  }

  private async presentIncidentDetail(
    incident: IncidentDetailRow,
    user: JwtPayload,
  ) {
    const { events, comments, ...rest } = incident;

    return {
      ...(await this.resolveIncidentAttachmentUrls(withSla(rest))),
      events: events.map(toPublicIncidentEvent),
      comments: comments.map(toPublicIncidentComment),
      canDelete:
        !incident.deletedAt &&
        (user.role === UserRole.ADMIN || clientMayDelete(incident, user)),
    };
  }

  private async resolveIncidentAttachmentUrls<
    T extends { attachments: IncidentAttachment[] },
  >(incident: T) {
    return {
      ...incident,
      attachments: await Promise.all(
        incident.attachments.map(async (attachment) => ({
          ...attachment,
          url: attachment.url.startsWith('http')
            ? attachment.url
            : await this.storageService.getDownloadUrl(attachment.url),
        })),
      ),
    };
  }

  private buildAttachmentKey(filename: string) {
    // "incidents/" + uuid + "-" ocupam 47 caracteres; o resto precisa caber em VARCHAR(191).
    const safeFilename = truncateFilename(
      filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
      100,
    );
    return `incidents/${randomUUID()}-${safeFilename}`;
  }
}
