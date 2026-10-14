import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Para o healthcheck do container e do proxy: 200 com o banco respondendo,
 * 503 sem ele. Não exige token e não expõe detalhes do erro. O storage fica de
 * fora de propósito: sem ele só os anexos falham, e reiniciar a API não ajuda.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      // A mensagem do Prisma tem várias linhas; a causa é a última.
      const reason =
        error instanceof Error
          ? error.message.trim().split('\n').pop()
          : String(error);
      this.logger.warn(`Banco indisponível: ${reason}`);
      throw new ServiceUnavailableException({ status: 'error' });
    }

    return { status: 'ok' };
  }
}
