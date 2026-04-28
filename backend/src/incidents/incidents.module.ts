import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';

@Module({
  providers: [IncidentsService, ErrorLogsApiKeyGuard],
  controllers: [IncidentsController],
  imports: [PrismaModule],
})
export class IncidentsModule {}
