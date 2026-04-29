import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
} from '@prisma/client';

@Injectable()
export class IncidentsService {
    constructor(private readonly prisma: PrismaService) {}

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
                        occurredAt: data.occurredAt
                            ? new Date(data.occurredAt)
                            : null,
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
