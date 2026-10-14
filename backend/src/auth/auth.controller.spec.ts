import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('AuthController', () => {
  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: 't', user: {} }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const prismaFake = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 2,
        email: 'cliente@example.com',
        role: UserRole.CLIENT,
        tokenVersion: 0,
        companyId: 7,
      }),
    },
  };
  const credentials = { email: 'user@example.com', password: 'secret-123' };

  const buildApp = async (trustProxy: number) => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET })],
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prismaFake },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', trustProxy);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    return { app, jwtService: moduleRef.get(JwtService) };
  };

  const http = (app: INestApplication) =>
    request(app.getHttpServer() as Server);
  const loggedIp = () =>
    (authService.login.mock.calls as [[unknown, string]])[0][1];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('client IP used by the login rate limit', () => {
    it('ignores X-Forwarded-For when no proxy is trusted', async () => {
      const { app } = await buildApp(0);

      await http(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '1.2.3.4')
        .send(credentials)
        .expect(201);

      expect(loggedIp()).not.toBe('1.2.3.4');
      expect(loggedIp()).toMatch(/127\.0\.0\.1|::1/);
      await app.close();
    });

    it('uses the address added by the trusted proxy', async () => {
      const { app } = await buildApp(1);

      await http(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '203.0.113.5')
        .send(credentials)
        .expect(201);

      expect(loggedIp()).toBe('203.0.113.5');
      await app.close();
    });

    it('cannot be spoofed by a value the client prepends to the header', async () => {
      const { app } = await buildApp(1);

      await http(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '9.9.9.9, 203.0.113.5')
        .send(credentials)
        .expect(201);

      expect(loggedIp()).toBe('203.0.113.5');
      await app.close();
    });
  });

  describe('POST /auth/logout', () => {
    it('requires authentication', async () => {
      const { app } = await buildApp(0);

      await http(app).post('/auth/logout').expect(401);

      expect(authService.logout).not.toHaveBeenCalled();
      await app.close();
    });

    it('revokes the tokens of the authenticated user', async () => {
      const { app, jwtService } = await buildApp(0);
      const token = jwtService.sign({
        sub: 2,
        email: 'cliente@example.com',
        role: UserRole.CLIENT,
        tv: 0,
      });

      await http(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(authService.logout).toHaveBeenCalledWith(2);
      await app.close();
    });
  });
});
