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
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('AdminsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const adminsService = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ user: { id: 7 } }),
    update: jest.fn().mockResolvedValue({ id: 7 }),
    resetPassword: jest.fn().mockResolvedValue({}),
    disable: jest.fn().mockResolvedValue({ id: 7 }),
    enable: jest.fn().mockResolvedValue({ id: 7 }),
  };
  // 1: admin; 2: cliente; 3: admin que ainda não trocou a senha temporária.
  const users: Record<number, { role: UserRole; mustChangePassword: boolean }> =
    {
      1: { role: UserRole.ADMIN, mustChangePassword: false },
      2: { role: UserRole.CLIENT, mustChangePassword: false },
      3: { role: UserRole.ADMIN, mustChangePassword: true },
    };

  const http = () => request(app.getHttpServer() as Server);
  const tokenFor = (id: 1 | 2 | 3) =>
    jwtService.sign({
      sub: id,
      email: 'u@example.com',
      role: users[id].role,
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
      controllers: [AdminsController],
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
                  ...users[where.id],
                  tokenVersion: 0,
                  disabledAt: null,
                  companyId:
                    users[where.id].role === UserRole.CLIENT ? 5 : null,
                  company: null,
                }),
            },
          },
        },
        { provide: AdminsService, useValue: adminsService },
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

  const admin = { name: 'Bia', email: 'bia@equipe.com' };
  const routes = [
    ['GET /admins', () => http().get('/admins')],
    ['POST /admins', () => http().post('/admins').send(admin)],
    ['PATCH /admins/7', () => http().patch('/admins/7').send({ name: 'x' })],
    ['POST password-reset', () => http().post('/admins/7/password-reset')],
    ['POST disable', () => http().post('/admins/7/disable')],
    ['POST enable', () => http().post('/admins/7/enable')],
  ] as const;

  it.each(routes)('%s requires a token', async (_, call) => {
    await call().expect(401);
  });

  it.each(routes)('%s is forbidden to clients', async (_, call) => {
    await call()
      .set('Authorization', `Bearer ${tokenFor(2)}`)
      .expect(403);

    Object.values(adminsService).forEach((mock) =>
      expect(mock).not.toHaveBeenCalled(),
    );
  });

  it.each(routes)(
    '%s waits until a new admin changes the temporary password',
    async (_, call) => {
      await call()
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .expect(403);

      Object.values(adminsService).forEach((mock) =>
        expect(mock).not.toHaveBeenCalled(),
      );
    },
  );

  it('normalizes the e-mail and trims the name on creation', async () => {
    await http()
      .post('/admins')
      .set('Authorization', asAdmin())
      .send({ name: '  Bia  ', email: '  Bia@Equipe.COM ' })
      .expect(201);

    expect(adminsService.create).toHaveBeenCalledWith({
      name: 'Bia',
      email: 'bia@equipe.com',
    });
  });

  it.each([
    ['without an e-mail', { name: 'Bia' }],
    ['with an invalid e-mail', { name: 'Bia', email: 'nao-e-email' }],
    ['with a blank name', { name: '  ', email: 'a@example.com' }],
    ['choosing a role', { ...admin, role: 'CLIENT' }],
    ['choosing a company', { ...admin, companyId: 5 }],
    ['choosing a password', { ...admin, password: 'x'.repeat(14) }],
  ])('rejects an admin %s', async (_, body) => {
    await http()
      .post('/admins')
      .set('Authorization', asAdmin())
      .send(body)
      .expect(400);

    expect(adminsService.create).not.toHaveBeenCalled();
  });

  it('passes who is acting and the target admin to the service', async () => {
    const token = asAdmin();

    await http().get('/admins').set('Authorization', token).expect(200);
    await http()
      .patch('/admins/7')
      .set('Authorization', token)
      .send({ email: 'Novo@Example.com' })
      .expect(200);
    await http()
      .post('/admins/7/password-reset')
      .set('Authorization', token)
      .expect(200);
    await http()
      .post('/admins/7/disable')
      .set('Authorization', token)
      .expect(200);
    await http()
      .post('/admins/7/enable')
      .set('Authorization', token)
      .expect(200);

    expect(adminsService.list).toHaveBeenCalledWith();
    expect(adminsService.update).toHaveBeenCalledWith(1, 7, {
      email: 'novo@example.com',
    });
    expect(adminsService.resetPassword).toHaveBeenCalledWith(1, 7);
    expect(adminsService.disable).toHaveBeenCalledWith(1, 7);
    expect(adminsService.enable).toHaveBeenCalledWith(1, 7);
  });

  it('rejects a non-numeric admin id', async () => {
    await http()
      .post('/admins/abc/disable')
      .set('Authorization', asAdmin())
      .expect(400);
  });
});
