import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthenticatedWebhookKey,
  WebhookKeysService,
} from './webhook-keys.service';

export type WebhookRequest = Request & {
  webhookKey: AuthenticatedWebhookKey;
};

/**
 * Autentica as rotas do webhook pela chave da empresa no header x-api-key e
 * deixa em request.webhookKey de qual empresa ela é. A empresa sai da chave,
 * nunca do corpo da requisição.
 */
@Injectable()
export class WebhookKeyGuard implements CanActivate {
  constructor(private readonly webhookKeys: WebhookKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const webhookKey = await this.webhookKeys.authenticate(
      request.header('x-api-key'),
    );

    if (!webhookKey) {
      throw new UnauthorizedException('API key inválida ou ausente');
    }

    request.webhookKey = webhookKey;
    return true;
  }
}
