import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  Prisma,
} from '@prisma/client';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly firstResponseTargetByPriority: Record<IncidentLevel, string> =
    {
      CRITICAL: 'até 2h úteis',
      ERROR: 'até 4h úteis',
      WARNING: 'até 1 dia útil',
      INFO: 'até 2 dias úteis',
    };

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

    return this.prisma.incident.findMany({
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
  }

  async createIncident(data: CreateIncidentDto) {
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
      },
      include: {
        client: true,
        attachments: true,
        logs: true,
      },
    });

    return {
      message: 'Ticket criado com sucesso',
      data: incident,
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

    return incident;
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

    const entries = incidents.map((incident) => {
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

    return {
      monthLabel: startDate.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      generatedAt: new Date().toISOString(),
      entries,
      correctiveActions: incidents
        .flatMap((incident) =>
          incident.logs.slice(0, 1).map((log) => `Incidente #${incident.id}: ${log.message}`),
        )
        .slice(0, 5),
      preventiveActions: [
        'Checklist de revisão fiscal e monitoramento de filas.',
        'Revisão preventiva de credenciais de integração por cliente.',
        'Acompanhamento de tendência de erros por origem e criticidade.',
      ],
      technicalIndicators: [
        {
          label: 'Incidentes atendidos',
          value: String(incidents.length),
          status: 'ATTENDED',
        },
        {
          label: 'Percentual críticos',
          value: incidents.length
            ? `${Math.round(
                (incidents.filter((incident) => incident.priority === IncidentLevel.CRITICAL)
                  .length /
                  incidents.length) *
                  100,
              )}%`
            : '0%',
          status: 'ATTENDED',
        },
        {
          label: 'Origem via webhook',
          value: incidents.length
            ? `${Math.round(
                (incidents.filter((incident) => incident.source === IncidentSource.WEBHOOK)
                  .length /
                  incidents.length) *
                  100,
              )}%`
            : '0%',
          status: 'ATTENDED',
        },
        {
          label: 'Chamados resolvidos',
          value: String(
            incidents.filter((incident) => incident.status === IncidentStatus.RESOLVED)
              .length,
          ),
          status: 'IN_PROGRESS',
        },
      ],
    };
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
}
