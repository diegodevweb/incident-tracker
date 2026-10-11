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
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('ClientsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const clientsService = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    create: jest.fn().mockResolvedValue({ client: { id: 5 } }),
    update: jest.fn().mockResolvedValue({ id: 5 }),
    resetPassword: jest.fn().mockResolvedValue({}),
    disable: jest.fn().mockResolvedValue({ id: 5 }),
    enable: jest.fn().mockResolvedValue({ id: 5 }),
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
  const asAdmin = () => `Bearer ${tokenFor(1)}`;

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
      controllers: [ClientsController],
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
                  mustChangePassword: false,
                  disabledAt: null,
                }),
            },
          },
        },
        { provide: ClientsService, useValue: clientsService },
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
    ['GET /clients', () => http().get('/clients')],
    [
      'POST /clients',
      () =>
        http()
          .post('/clients')
          .send({ name: 'Empresa', email: 'empresa@example.com' }),
    ],
    ['PATCH /clients/5', () => http().patch('/clients/5').send({ name: 'x' })],
    ['POST password-reset', () => http().post('/clients/5/password-reset')],
    ['POST disable', () => http().post('/clients/5/disable')],
    ['POST enable', () => http().post('/clients/5/enable')],
  ] as const;

  it.each(routes)('%s requires a token', async (_, call) => {
    await call().expect(401);
  });

  it.each(routes)('%s is forbidden to clients', async (_, call) => {
    await call()
      .set('Authorization', `Bearer ${tokenFor(2)}`)
      .expect(403);

    Object.values(clientsService).forEach((mock) =>
      expect(mock).not.toHaveBeenCalled(),
    );
  });

  it('normalizes the e-mail and trims the name on creation', async () => {
    await http()
      .post('/clients')
      .set('Authorization', asAdmin())
      .send({ name: '  Empresa  ', email: '  Contato@Empresa.COM ' })
      .expect(201);

    expect(clientsService.create).toHaveBeenCalledWith({
      name: 'Empresa',
      email: 'contato@empresa.com',
    });
  });

  it.each([
    ['without an e-mail', { name: 'Empresa' }],
    ['with an invalid e-mail', { name: 'Empresa', email: 'nao-e-email' }],
    ['with a blank name', { name: '  ', email: 'a@example.com' }],
    ['choosing a role', { name: 'E', email: 'a@example.com', role: 'ADMIN' }],
    [
      'choosing a password',
      { name: 'E', email: 'a@example.com', password: 'x'.repeat(14) },
    ],
  ])('rejects a client %s', async (_, body) => {
    await http()
      .post('/clients')
      .set('Authorization', asAdmin())
      .send(body)
      .expect(400);

    expect(clientsService.create).not.toHaveBeenCalled();
  });

  it('passes numeric ids and the query to the service', async () => {
    const admin = asAdmin();

    await http()
      .get('/clients?page=2&pageSize=50&q=acme')
      .set('Authorization', admin)
      .expect(200);
    await http()
      .patch('/clients/5')
      .set('Authorization', admin)
      .send({ email: 'Novo@Example.com' })
      .expect(200);
    await http()
      .post('/clients/5/password-reset')
      .set('Authorization', admin)
      .expect(200);
    await http()
      .post('/clients/5/disable')
      .set('Authorization', admin)
      .expect(200);
    await http()
      .post('/clients/5/enable')
      .set('Authorization', admin)
      .expect(200);

    expect(clientsService.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      q: 'acme',
    });
    expect(clientsService.update).toHaveBeenCalledWith(5, {
      email: 'novo@example.com',
    });
    expect(clientsService.resetPassword).toHaveBeenCalledWith(5);
    expect(clientsService.disable).toHaveBeenCalledWith(5);
    expect(clientsService.enable).toHaveBeenCalledWith(5);
  });

  it('caps the page size at 100', async () => {
    await http()
      .get('/clients?pageSize=101')
      .set('Authorization', asAdmin())
      .expect(400);
  });

  it('rejects non-numeric ids', async () => {
    await http()
      .post('/clients/abc/disable')
      .set('Authorization', asAdmin())
      .expect(400);
  });
});
