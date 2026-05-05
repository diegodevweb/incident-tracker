import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const DEV_USERS = [
  {
    name: 'Diego Rodrigues',
    email: 'diego.devwebb@gmail.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
  },
  {
    name: 'Marcos Vieira',
    email: 'marcos.vieira@atacadodelta.com.br',
    password: 'Cliente@123',
    role: UserRole.CLIENT,
  },
] as const;

@Injectable()
export class DevAuthSeedService implements OnModuleInit {
  private readonly logger = new Logger(DevAuthSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    for (const user of DEV_USERS) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      await this.prisma.user.upsert({
        where: {
          email: user.email,
        },
        update: {
          name: user.name,
          role: user.role,
          password: passwordHash,
        },
        create: {
          name: user.name,
          email: user.email,
          password: passwordHash,
          role: user.role,
        },
      });
    }

    this.logger.log('Usuários de desenvolvimento garantidos para autenticação');
  }
}
