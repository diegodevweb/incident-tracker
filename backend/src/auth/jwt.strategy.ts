import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { isBlockedAccount } from './blocked-account';
import { getJwtSecret } from './jwt-secret';
import { JwtPayload, JwtTokenPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  /**
   * Papel e empresa vêm do banco, não do token: usuário removido, desativado,
   * rebaixado ou de empresa desativada perde o acesso na hora, e o logout (que
   * muda tokenVersion) invalida o token.
   */
  async validate(payload: JwtTokenPayload): Promise<JwtPayload> {
    if (typeof payload.sub !== 'number') {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        mustChangePassword: true,
        disabledAt: true,
        companyId: true,
        company: { select: { disabledAt: true } },
      },
    });

    if (!user || user.tokenVersion !== payload.tv || isBlockedAccount(user)) {
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      companyId: user.companyId,
    };
  }
}
