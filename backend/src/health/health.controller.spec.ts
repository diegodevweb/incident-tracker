import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: jest.fn() };

  const http = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // Limite baixo para provar que o healthcheck não entra no rate limit.
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.$queryRaw.mockReset();
  });

  it('answers 200 without a token when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    await http().get('/health').expect(200, { status: 'ok' });
  });

  it('answers 503 without error details when the database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error("Can't reach database server at mysql:3306"),
    );

    const response = await http().get('/health').expect(503);

    expect(response.body).toEqual({ status: 'error' });
    expect(JSON.stringify(response.body)).not.toContain('mysql');
  });

  it('is not rate limited', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    for (let i = 0; i < 5; i++) {
      await http().get('/health').expect(200);
    }
  });
});
