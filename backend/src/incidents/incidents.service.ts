import { Injectable } from '@nestjs/common';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IncidentsService {
    constructor(private readonly prisma: PrismaService) {}

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
