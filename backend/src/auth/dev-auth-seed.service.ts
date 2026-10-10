import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const MIN_SEED_PASSWORD_LENGTH = 12;

@Injectable()
export class DevAuthSeedService implements OnModuleInit {
  private readonly logger = new Logger(DevAuthSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.configService.get<string>('SEED_DEV_USERS') !== 'true') {
      return;
    }

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(
        'SEED_DEV_USERS ignorado: o seed de desenvolvimento nunca roda com NODE_ENV=production',
      );
      return;
    }

    const devUsers = [
      {
        name: 'Admin Dev',
        email:
          this.configService.get<string>('SEED_ADMIN_EMAIL') ??
          'admin@example.com',
        password: this.getSeedPassword('SEED_ADMIN_PASSWORD'),
        role: UserRole.ADMIN,
      },
      {
        name: 'Cliente Dev',
        email:
          this.configService.get<string>('SEED_CLIENT_EMAIL') ??
          'cliente@example.com',
        password: this.getSeedPassword('SEED_CLIENT_PASSWORD'),
        role: UserRole.CLIENT,
      },
    ];

    for (const user of devUsers) {
      const existing = await this.prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await this.prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: await bcrypt.hash(user.password, 10),
          role: user.role,
        },
      });
    }

    this.logger.log('Usuários de desenvolvimento garantidos para autenticação');
  }

  private getSeedPassword(key: string) {
    const password = this.configService.getOrThrow<string>(key);

    if (password.length < MIN_SEED_PASSWORD_LENGTH) {
      throw new Error(
        `${key} precisa ter pelo menos ${MIN_SEED_PASSWORD_LENGTH} caracteres`,
      );
    }

    return password;
  }
}
