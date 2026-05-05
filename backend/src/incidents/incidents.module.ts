import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';
import { StorageModule } from '../storage/storage.module';

@Module({
  providers: [IncidentsService, ErrorLogsApiKeyGuard],
  controllers: [IncidentsController],
  imports: [PrismaModule, StorageModule],
})
export class IncidentsModule {}
