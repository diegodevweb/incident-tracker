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
import { PASSWORD_CHANGE_REQUIRED } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountController,
  CHANGE_PASSWORD_THROTTLE,
} from './account.controller';
import { AccountService } from './account.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('AccountController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const accountService = {
    getProfile: jest.fn().mockResolvedValue({ id: 2 }),
    updateProfile: jest.fn().mockResolvedValue({ id: 2 }),
    changePassword: jest.fn().mockResolvedValue({ accessToken: 't' }),
  };
  const dbUser = {
    id: 2,
    email: 'cliente@example.com',
    role: UserRole.CLIENT,
    tokenVersion: 0,
    mustChangePassword: false,
    disabledAt: null as Date | null,
  };
  let current = { ...dbUser };

  const http = () => request(app.getHttpServer() as Server);
  const token = () =>
    jwtService.sign({
      sub: 2,
      email: 'cliente@example.com',
      role: UserRole.CLIENT,
      tv: 0,
    });
  const passwordBody = {
    currentPassword: 'x'.repeat(14),
    newPassword: 'y'.repeat(14),
  };

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
      controllers: [AccountController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: () => Promise.resolve(current) } },
        },
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    // Para o teste de limite usar um IP só dele (X-Forwarded-For).
    nestApp.set('trust proxy', 1);
    app = nestApp;
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    current = { ...dbUser };
  });

  it('requires a token', async () => {
    await http().get('/account').expect(401);
  });

  it('trims the name before validating it', async () => {
    await http()
      .patch('/account')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: '  Novo nome  ' })
      .expect(200);

    expect(accountService.updateProfile).toHaveBeenCalledWith(2, {
      name: 'Novo nome',
    });
  });

  it.each([
    ['a blank name', { name: '   ' }],
    ['an e-mail change', { name: 'Nome', email: 'outro@example.com' }],
  ])('rejects %s', async (_, body) => {
    await http()
      .patch('/account')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);

    expect(accountService.updateProfile).not.toHaveBeenCalled();
  });

  describe('with a temporary password', () => {
    beforeEach(() => {
      current.mustChangePassword = true;
    });

    it('still reads the account and changes the password', async () => {
      await http()
        .get('/account')
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);
      await http()
        .post('/account/password')
        .set('Authorization', `Bearer ${token()}`)
        .send(passwordBody)
        .expect(200);

      expect(accountService.changePassword).toHaveBeenCalledWith(
        2,
        passwordBody,
      );
    });

    it('blocks everything else until the password is changed', async () => {
      const response = await http()
        .patch('/account')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Nome' })
        .expect(403);

      expect(response.body).toMatchObject({ code: PASSWORD_CHANGE_REQUIRED });
      expect(accountService.updateProfile).not.toHaveBeenCalled();
    });
  });

  it('logs a disabled account out', async () => {
    current.disabledAt = new Date();

    await http()
      .get('/account')
      .set('Authorization', `Bearer ${token()}`)
      .expect(401);
  });

  it('limits password change attempts per client IP', async () => {
    const attempt = () =>
      http()
        .post('/account/password')
        .set('Authorization', `Bearer ${token()}`)
        .set('X-Forwarded-For', '198.51.100.40')
        .send(passwordBody);

    for (let i = 0; i < CHANGE_PASSWORD_THROTTLE.limit; i++) {
      await attempt().expect(200);
    }

    await attempt().expect(429);
  });
});
