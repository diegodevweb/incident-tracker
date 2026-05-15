import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimitService } from './login-rate-limit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loginRateLimitService: LoginRateLimitService,
  ) {}

  async login({ email, password }: LoginDto, ipAddress: string) {
    const normalizedEmail = email.toLowerCase();
    const rateLimitKey = this.loginRateLimitService.buildKey(
      ipAddress,
      normalizedEmail,
    );

    this.loginRateLimitService.check(rateLimitKey);

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      this.loginRateLimitService.registerFailure(rateLimitKey);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      this.loginRateLimitService.registerFailure(rateLimitKey);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.loginRateLimitService.reset(rateLimitKey);

    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        role: user.role,
        email: user.email,
      }),
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
