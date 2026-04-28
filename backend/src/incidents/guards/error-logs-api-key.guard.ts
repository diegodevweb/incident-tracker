import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class ErrorLogsApiKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = request.header('x-api-key');
        const expectedApiKey = process.env.ERROR_LOGS_API_KEY;

        if (!expectedApiKey) {
            throw new UnauthorizedException('API key não configurada no servidor');
        }

        if (!apiKey || apiKey !== expectedApiKey) {
            throw new UnauthorizedException('API key inválida ou ausente');
        }

        return true;
    }
}