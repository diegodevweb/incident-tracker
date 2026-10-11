import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { WebhookKeysModule } from '../webhook-keys/webhook-keys.module';

@Module({
  providers: [IncidentsService],
  controllers: [IncidentsController],
  imports: [PrismaModule, StorageModule, WebhookKeysModule],
})
export class IncidentsModule {}
