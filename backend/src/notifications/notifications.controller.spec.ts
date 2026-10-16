import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('NotificationsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const notificationsService = {
    list: jest.fn().mockResolvedValue({ unreadCount: 0, items: [] }),
    markRead: jest.fn().mockResolvedValue({ unreadCount: 0 }),
  };
  const dbUser = {
    id: 2,
    email: 'cliente@example.com',
    role: UserRole.CLIENT,
    tokenVersion: 0,
    mustChangePassword: false,
    disabledAt: null,
    companyId: 7,
  };

  const http = () => request(app.getHttpServer() as Server);
  const token = () =>
    jwtService.sign({
      sub: 2,
      email: 'cliente@example.com',
      role: UserRole.CLIENT,
      tv: 0,
    });

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
      ],
      controllers: [NotificationsController],
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: { user: { findUnique: () => Promise.resolve(dbUser) } },
        },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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
  });

  it('requires a token', async () => {
    await http().get('/notifications').expect(401);
    await http().post('/notifications/read').expect(401);
  });

  it('lists the notices of the logged user', async () => {
    await http()
      .get('/notifications')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);

    expect(notificationsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 2 }),
    );
  });

  it('marks the notices of one incident as read', async () => {
    await http()
      .post('/notifications/read')
      .set('Authorization', `Bearer ${token()}`)
      .send({ incidentId: 10 })
      .expect(200);

    expect(notificationsService.markRead).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 2 }),
      10,
    );
  });

  it.each([
    ['an incident id that is not a number', { incidentId: 'abc' }],
    ['another user id', { userId: 3 }],
  ])('rejects %s', async (_, body) => {
    await http()
      .post('/notifications/read')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);

    expect(notificationsService.markRead).not.toHaveBeenCalled();
  });
});
