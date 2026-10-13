import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from './allow-pending-password-change.decorator';
import type { AuthenticatedRequest } from './authenticated-request.type';

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) {
      return false;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowsPendingChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Com senha temporária, só a troca de senha, a própria conta e o logout.
    if (user.mustChangePassword && !allowsPendingChange) {
      throw new ForbiddenException({
        message: 'Troque a senha temporária antes de continuar',
        code: PASSWORD_CHANGE_REQUIRED,
      });
    }

    return true;
  }
}
