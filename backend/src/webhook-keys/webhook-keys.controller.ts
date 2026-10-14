import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateWebhookKeyDto } from './dto/create-webhook-key.dto';
import { WebhookKeysService } from './webhook-keys.service';

/**
 * Gestão das chaves de webhook de uma empresa, só para ADMIN. Para trocar uma
 * chave: criar a nova, configurar na integração e revogar a antiga.
 */
@Controller('companies/:companyId/webhook-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class WebhookKeysController {
  constructor(private readonly webhookKeys: WebhookKeysService) {}

  @Get()
  list(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.webhookKeys.list(companyId);
  }

  @Post()
  create(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() body: CreateWebhookKeyDto,
  ) {
    return this.webhookKeys.create(companyId, body.name);
  }

  @Delete(':keyId')
  revoke(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('keyId', ParseIntPipe) keyId: number,
  ) {
    return this.webhookKeys.revoke(companyId, keyId);
  }
}
