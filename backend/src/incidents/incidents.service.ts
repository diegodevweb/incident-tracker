import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IncidentsService {
    constructor(private readonly prisma: PrismaService) {}

    async getErrorLogs() {
        const incidentList = await this.prisma.incidentLog.findMany();

        if (!incidentList || incidentList.length === 0) {
            throw new NotFoundException('Nenhum registro encontrado');
        }

        return incidentList;
    }

    async getErrorLog(id: number) {
        const incidentLog = await this.prisma.incidentLog.findUnique({
            where: { id },
        });

        if (!incidentLog) {
            throw new NotFoundException(`Registro não encontrado para o ID ${id}`);
        }

        return incidentLog;
    }

    async createErrorLog(data: CreateErrorLogDto) {
        const incidentLog = await this.prisma.incidentLog.create({
            data: {
                message: data.message,
                level: data.level,
                environment: data.environment,
                source: data.source,
                occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
                metadata: data.metadata ?? undefined,
            }
        });


        return {
            message: 'Erro cadastrado com sucesso',
            data: incidentLog,
        };
    }
}
