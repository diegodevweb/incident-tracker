import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookKeyGuard } from './webhook-key.guard';
import { WebhookKeysController } from './webhook-keys.controller';
import { WebhookKeysService } from './webhook-keys.service';

@Module({
  imports: [PrismaModule],
  controllers: [WebhookKeysController],
  providers: [WebhookKeysService, WebhookKeyGuard],
  exports: [WebhookKeysService, WebhookKeyGuard],
})
export class WebhookKeysModule {}
