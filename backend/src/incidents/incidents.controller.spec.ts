import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtStrategy } from '../auth/jwt.strategy';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('IncidentsController authorization', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const incidentsService = {
    getIncidents: jest.fn().mockResolvedValue([]),
    getIncident: jest.fn().mockResolvedValue({ id: 1 }),
    createIncident: jest.fn().mockResolvedValue({ message: 'ok' }),
    updateIncident: jest.fn().mockResolvedValue({ id: 1 }),
    getMonthlyReport: jest.fn().mockResolvedValue({}),
    createPreventiveAction: jest.fn().mockResolvedValue({ id: 1 }),
  };

  const tokenFor = (role: UserRole, secret = JWT_SECRET) =>
    jwtService.sign(
      { sub: role === UserRole.ADMIN ? 1 : 2, email: 'u@example.com', role },
      { secret },
    );
  const http = () => request(app.getHttpServer() as Server);
  const adminToken = () => tokenFor(UserRole.ADMIN);
  const clientToken = () => tokenFor(UserRole.CLIENT);

  const monthlyQuery = {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z',
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
      ],
      controllers: [IncidentsController],
      providers: [
        JwtStrategy,
        { provide: IncidentsService, useValue: incidentsService },
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

  describe('admin-only routes', () => {
    const adminOnlyRoutes = [
      {
        name: 'GET /incidents/reports/monthly',
        send: (token?: string) =>
          withToken(
            http().get('/incidents/reports/monthly').query(monthlyQuery),
            token,
          ),
        handler: () => incidentsService.getMonthlyReport,
      },
      {
        name: 'PATCH /incidents/:id',
        send: (token?: string) =>
          withToken(
            http().patch('/incidents/1').send({ status: 'RESOLVED' }),
            token,
          ),
        handler: () => incidentsService.updateIncident,
      },
      {
        name: 'POST /incidents/preventive-actions',
        send: (token?: string) =>
          withToken(
            http()
              .post('/incidents/preventive-actions')
              .send({ description: 'Revisar timeouts' }),
            token,
          ),
        handler: () => incidentsService.createPreventiveAction,
      },
    ];

    function withToken(req: request.Test, token?: string) {
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    }

    it.each(adminOnlyRoutes)(
      '$name rejects requests without a token',
      async ({ send, handler }) => {
        await send().expect(401);

        expect(handler()).not.toHaveBeenCalled();
      },
    );

    it.each(adminOnlyRoutes)(
      '$name rejects a token signed with another secret',
      async ({ send, handler }) => {
        await send(
          tokenFor(UserRole.ADMIN, 'another-secret-with-more-than-32-bytes'),
        ).expect(401);

        expect(handler()).not.toHaveBeenCalled();
      },
    );

    it.each(adminOnlyRoutes)(
      '$name returns 403 for a CLIENT and never reaches the service',
      async ({ send, handler }) => {
        await send(clientToken()).expect(403);

        expect(handler()).not.toHaveBeenCalled();
      },
    );

    it.each(adminOnlyRoutes)(
      '$name works for an ADMIN',
      async ({ send, handler }) => {
        const response = await send(adminToken());

        expect(response.status).toBeLessThan(300);
        expect(handler()).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('routes open to any authenticated user', () => {
    it('lets a CLIENT list incidents, scoped by the service with their own identity', async () => {
      await http()
        .get('/incidents')
        .set('Authorization', `Bearer ${clientToken()}`)
        .expect(200);

      expect(incidentsService.getIncidents).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
      );
    });

    it('lets a CLIENT read a single incident', async () => {
      await http()
        .get('/incidents/1')
        .set('Authorization', `Bearer ${clientToken()}`)
        .expect(200);

      expect(incidentsService.getIncident).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
      );
    });

    it('lets a CLIENT open a ticket', async () => {
      await http()
        .post('/incidents')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({
          title: 'Erro na emissão',
          description: 'Nota rejeitada',
          environment: 'production',
        })
        .expect(201);

      expect(incidentsService.createIncident).toHaveBeenCalledTimes(1);
    });
  });
});
