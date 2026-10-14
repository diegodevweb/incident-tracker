import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import {
  WebhookKeysService,
  generateWebhookKey,
} from '../webhook-keys/webhook-keys.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { UPLOAD_THROTTLE, WEBHOOK_THROTTLE } from './limits';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('Incidents throttling', () => {
  let app: INestApplication;
  let clientToken: string;
  const webhookKey = generateWebhookKey().key;

  const ticket = {
    title: 'Erro na emissão',
    description: 'Nota rejeitada',
    environment: 'production',
  };
  const errorLog = {
    title: 'Falha',
    description: 'Falha na integração',
    message: 'timeout',
    environment: 'production',
  };

  const http = () => request(app.getHttpServer() as Server);
  const openTicket = (ip: string) =>
    http()
      .post('/incidents')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('X-Forwarded-For', ip)
      .send(ticket);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET })],
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      ],
      controllers: [IncidentsController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: () =>
                Promise.resolve({
                  id: 2,
                  email: 'cliente@example.com',
                  role: UserRole.CLIENT,
                  tokenVersion: 0,
                  companyId: 7,
                }),
            },
          },
        },
        {
          provide: IncidentsService,
          useValue: {
            createIncident: jest.fn().mockResolvedValue({ message: 'ok' }),
            createErrorLog: jest.fn().mockResolvedValue({ message: 'ok' }),
          },
        },
        {
          provide: WebhookKeysService,
          useValue: {
            authenticate: (key?: string) =>
              Promise.resolve(
                key === webhookKey ? { id: 1, clientId: 2 } : null,
              ),
          },
        },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    nestApp.set('trust proxy', 1);
    nestApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await nestApp.init();
    app = nestApp;
    clientToken = moduleRef.get(JwtService).sign({
      sub: 2,
      email: 'cliente@example.com',
      role: UserRole.CLIENT,
      tv: 0,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('throttles ticket creation per client IP once the upload limit is exceeded', async () => {
    for (let i = 0; i < UPLOAD_THROTTLE.limit; i++) {
      await openTicket('198.51.100.1').expect(201);
    }

    await openTicket('198.51.100.1').expect(429);
  });

  it('keeps a separate budget for each real client IP', async () => {
    await openTicket('198.51.100.2').expect(201);
  });

  it('gives the webhook a much larger budget than uploads', async () => {
    expect(WEBHOOK_THROTTLE.limit).toBeGreaterThan(UPLOAD_THROTTLE.limit * 10);

    for (let i = 0; i < UPLOAD_THROTTLE.limit + 5; i++) {
      await http()
        .post('/incidents/error-logs')
        .set('x-api-key', webhookKey)
        .set('X-Forwarded-For', '198.51.100.3')
        .send(errorLog)
        .expect(201);
    }
  });
});
