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
import { WebhookKeysController } from './webhook-keys.controller';
import { WebhookKeysService } from './webhook-keys.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('WebhookKeysController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const webhookKeys = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    revoke: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const roles: Record<number, UserRole> = {
    1: UserRole.ADMIN,
    2: UserRole.CLIENT,
  };

  const http = () => request(app.getHttpServer() as Server);
  const tokenFor = (id: 1 | 2) =>
    jwtService.sign({
      sub: id,
      email: 'u@example.com',
      role: roles[id],
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
      controllers: [WebhookKeysController],
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: ({ where }: { where: { id: number } }) =>
                Promise.resolve({
                  id: where.id,
                  email: 'u@example.com',
                  role: roles[where.id],
                  tokenVersion: 0,
                }),
            },
          },
        },
        { provide: WebhookKeysService, useValue: webhookKeys },
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

  const routes = [
    ['GET', () => http().get('/clients/2/webhook-keys')],
    [
      'POST',
      () => http().post('/clients/2/webhook-keys').send({ name: 'ERP' }),
    ],
    ['DELETE', () => http().delete('/clients/2/webhook-keys/5')],
  ] as const;

  it.each(routes)('%s requires a token', async (_, call) => {
    await call().expect(401);
  });

  it.each(routes)('%s is forbidden to clients', async (_, call) => {
    await call()
      .set('Authorization', `Bearer ${tokenFor(2)}`)
      .expect(403);

    expect(webhookKeys.list).not.toHaveBeenCalled();
    expect(webhookKeys.create).not.toHaveBeenCalled();
    expect(webhookKeys.revoke).not.toHaveBeenCalled();
  });

  it('lets an admin list, create and revoke keys', async () => {
    const admin = `Bearer ${tokenFor(1)}`;

    await http()
      .get('/clients/2/webhook-keys')
      .set('Authorization', admin)
      .expect(200);
    await http()
      .post('/clients/2/webhook-keys')
      .set('Authorization', admin)
      .send({ name: 'ERP produção' })
      .expect(201);
    await http()
      .delete('/clients/2/webhook-keys/5')
      .set('Authorization', admin)
      .expect(200);

    expect(webhookKeys.list).toHaveBeenCalledWith(2);
    expect(webhookKeys.create).toHaveBeenCalledWith(2, 'ERP produção');
    expect(webhookKeys.revoke).toHaveBeenCalledWith(2, 5);
  });

  it.each([
    ['without a name', {}],
    ['with an empty name', { name: '' }],
    ['with a name over 191 characters', { name: 'x'.repeat(192) }],
    ['with extra fields', { name: 'ERP', keyHash: 'abc' }],
  ])('rejects a key %s', async (_, body) => {
    await http()
      .post('/clients/2/webhook-keys')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .send(body)
      .expect(400);

    expect(webhookKeys.create).not.toHaveBeenCalled();
  });

  it('rejects non-numeric ids', async () => {
    await http()
      .delete('/clients/abc/webhook-keys/5')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .expect(400);
  });
});
