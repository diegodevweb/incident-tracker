import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AttachmentCategory,
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  Prisma,
} from '@prisma/client';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreatePreventiveActionDto } from './dto/create-preventive-action.dto';
import { StorageService } from '../storage/storage.types';
import { randomUUID } from 'node:crypto';

type UploadedAttachment = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type IncidentWithRelations = Prisma.IncidentGetPayload<{
  include: {
    client: true;
    attachments: true;
    logs: true;
  };
}>;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private readonly firstResponseTargetByPriority: Record<IncidentLevel, string> =
    {
      CRITICAL: 'até 2h úteis',
      ERROR: 'até 4h úteis',
      WARNING: 'até 1 dia útil',
      INFO: 'até 2 dias úteis',
    };

  private readonly slaRules = (
    Object.entries(this.firstResponseTargetByPriority) as [IncidentLevel, string][]
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

  private buildPeriodLabel(startDate: Date, endDate: Date) {
    const sameMonth =
      startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
      startDate.getUTCMonth() === endDate.getUTCMonth();

    if (sameMonth) {
      return startDate.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }

    return `${startDate.toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
    })} a ${endDate.toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
    })}`;
  }

  async getIncidents(query: ListIncidentsQueryDto) {
    const where: Prisma.IncidentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.environment ? { environment: query.environment } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.client
        ? {
            client: {
              name: {
                contains: query.client,
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

    const incidents = await this.prisma.incident.findMany({
      where,
      include: {
        client: true,
        attachments: true,
        logs: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Promise.all(incidents.map((incident) => this.resolveIncidentAttachmentUrls(incident)));
  }

  async createIncident(
    data: CreateIncidentDto,
    attachments: UploadedAttachment[] = [],
  ) {
    const generalAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const key = this.buildAttachmentKey(attachment.originalname);
        const uploadedAttachment = await this.storageService.uploadObject({
          key,
          body: attachment.buffer,
          contentType: attachment.mimetype,
        });

        return {
          filename: attachment.originalname,
          mimeType: attachment.mimetype,
          url: uploadedAttachment.key,
          category: AttachmentCategory.GENERAL,
        };
      }),
    );

    const incident = await this.prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status ?? IncidentStatus.OPEN,
        priority: data.priority ?? IncidentLevel.ERROR,
        source: IncidentSource.DASHBOARD,
        environment: data.environment,
        clientId: data.clientId,
        logs: {
          create: {
            message: data.description,
            level: data.priority ?? IncidentLevel.ERROR,
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
      },
      include: {
        client: true,
        attachments: true,
        logs: true,
      },
    });

    return {
      message: 'Ticket criado com sucesso',
      data: await this.resolveIncidentAttachmentUrls(incident),
    };
  }

  async getIncident(id: number) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        client: true,
        attachments: true,
        logs: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incidente não encontrado para o ID ${id}`);
    }

    return this.resolveIncidentAttachmentUrls(incident);
  }

  async getMonthlyReport(query: MonthlyReportQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(query.clientId ? { clientId: query.clientId } : {}),
      },
      include: {
        client: true,
        attachments: true,
        logs: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const incidentsWithAttachmentUrls = await Promise.all(
      incidents.map((incident) => this.resolveIncidentAttachmentUrls(incident)),
    );

    const entries = incidentsWithAttachmentUrls.map((incident) => {
      const createdAt = incident.createdAt;
      const latestLog = incident.logs[0];

      return {
        incidentId: incident.id,
        year: createdAt.getUTCFullYear(),
        month: createdAt.toLocaleString('pt-BR', {
          month: 'long',
          timeZone: 'UTC',
        }),
        day: createdAt.toLocaleString('pt-BR', {
          weekday: 'long',
          timeZone: 'UTC',
        }),
        date: createdAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        time: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        minute: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: 'UTC',
          minute: '2-digit',
        }),
        second: createdAt.toLocaleTimeString('pt-BR', {
          timeZone: 'UTC',
          second: '2-digit',
        }),
        errorType: incident.priority,
        source: incident.source,
        slaTarget: this.firstResponseTargetByPriority[incident.priority],
        priority: incident.priority,
        description: incident.description,
        status: incident.status,
        clientName: incident.client.name,
        latestLogMessage: latestLog?.message ?? null,
      };
    });

    const preventiveActions = await this.prisma.preventiveAction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
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
            (attachment) => attachment.category === AttachmentCategory.CORRECTIVE_ACTION,
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
          label: 'Incidentes atendidos',
          value: String(incidentsWithAttachmentUrls.length),
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

  async updateIncident(id: number, data: UpdateIncidentDto) {
    await this.getIncident(id);

    const attachmentPayload =
      data.correctiveActionAttachments?.filter(
        (attachment) => attachment.filename.trim() && attachment.url.trim(),
      ) ?? [];

    const incident = await this.prisma.incident.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.correctiveActions !== undefined
          ? { correctiveActions: data.correctiveActions || null }
          : {}),
        ...(data.correctiveActionAttachments
          ? {
              attachments: {
                deleteMany: {
                  category: AttachmentCategory.CORRECTIVE_ACTION,
                },
                create: attachmentPayload.map((attachment) => ({
                  ...attachment,
                  category: AttachmentCategory.CORRECTIVE_ACTION,
                })),
              },
            }
          : {}),
      },
      include: {
        client: true,
        attachments: true,
        logs: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    return this.resolveIncidentAttachmentUrls(incident);
  }

  async createPreventiveAction(data: CreatePreventiveActionDto) {
    if (data.incidentId) {
      await this.getIncident(data.incidentId);
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

  async getErrorLogs() {
    const incidentList = await this.prisma.incidentLog.findMany({
      include: {
        incident: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!incidentList || incidentList.length === 0) {
      throw new NotFoundException('Nenhum registro encontrado');
    }

    return incidentList;
  }

  async getErrorLog(id: number) {
    const incidentLog = await this.prisma.incidentLog.findUnique({
      where: { id },
      include: {
        incident: true,
      },
    });

    if (!incidentLog) {
      throw new NotFoundException(`Registro não encontrado para o ID ${id}`);
    }

    return incidentLog;
  }

  async createErrorLog(data: CreateErrorLogDto) {
    const incidentLog = await this.prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status ?? IncidentStatus.OPEN,
        priority: data.priority ?? IncidentLevel.ERROR,
        source: data.source ?? IncidentSource.WEBHOOK,
        environment: data.environment,
        clientId: data.clientId,
        logs: {
          create: {
            message: data.message,
            level: data.level ?? IncidentLevel.ERROR,
            occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
            metadata: data.metadata ?? undefined,
          },
        },
      },
      include: {
        logs: true,
        client: true,
      },
    });


    return {
      message: 'Erro cadastrado com sucesso',
      data: incidentLog,
    };
}

  private async resolveIncidentAttachmentUrls(incident: IncidentWithRelations) {
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
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `incidents/${randomUUID()}-${safeFilename}`;
  }
}
