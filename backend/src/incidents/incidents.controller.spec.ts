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
import { MAX_INCIDENT_ATTACHMENTS, MAX_UPLOAD_FILE_BYTES } from './limits';

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
    getErrorLogs: jest.fn().mockResolvedValue([]),
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

  describe('upload and input limits', () => {
    const validTicket = {
      title: 'Erro na emissão',
      description: 'Nota rejeitada',
      environment: 'production',
    };
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const openTicketWith = (fields: Record<string, string>) => {
      const req = http()
        .post('/incidents')
        .set('Authorization', `Bearer ${clientToken()}`);
      Object.entries(fields).forEach(([key, value]) => {
        req.field(key, value);
      });
      return req;
    };

    it('rejects a file above the size limit with 413 before reaching the service', async () => {
      const oversized = Buffer.alloc(MAX_UPLOAD_FILE_BYTES + 1, 0);

      await openTicketWith(validTicket)
        .attach('attachments', oversized, 'big.png')
        .expect(413);

      expect(incidentsService.createIncident).not.toHaveBeenCalled();
    });

    it('accepts a file within the size limit', async () => {
      await openTicketWith(validTicket)
        .attach('attachments', png, 'ok.png')
        .expect(201);

      expect(incidentsService.createIncident).toHaveBeenCalledTimes(1);
    });

    it('rejects more files than allowed', async () => {
      const req = openTicketWith(validTicket);
      for (let i = 0; i <= MAX_INCIDENT_ATTACHMENTS; i++) {
        req.attach('attachments', png, `p${i}.png`);
      }

      await req.expect(400);

      expect(incidentsService.createIncident).not.toHaveBeenCalled();
    });

    it('rejects a description longer than the column with 400 instead of failing in the database', async () => {
      await http()
        .post('/incidents')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ ...validTicket, description: 'x'.repeat(192) })
        .expect(400);

      expect(incidentsService.createIncident).not.toHaveBeenCalled();
    });

    it('accepts corrective attachments in the multipart field the frontend sends', async () => {
      await http()
        .patch('/incidents/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .field('correctiveActions', 'Reiniciado o serviço')
        .attach('correctiveAttachments', png, 'fix.png')
        .expect(200);

      expect(incidentsService.updateIncident).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ correctiveActions: 'Reiniciado o serviço' }),
        expect.anything(),
        [expect.objectContaining({ originalname: 'fix.png' })],
      );
    });

    it('rejects files sent under the old field name, which the frontend no longer uses', async () => {
      await http()
        .patch('/incidents/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('correctiveActionAttachments', png, 'fix.png')
        .expect(400);

      expect(incidentsService.updateIncident).not.toHaveBeenCalled();
    });

    it('rejects the old JSON contract of corrective attachments (external URLs)', async () => {
      await http()
        .patch('/incidents/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          correctiveActionAttachments: [
            {
              filename: 'x.png',
              mimeType: 'image/png',
              url: 'https://evil.example/x',
            },
          ],
        })
        .expect(400);

      expect(incidentsService.updateIncident).not.toHaveBeenCalled();
    });
  });
  describe('pagination query validation', () => {
    const originalApiKey = process.env.ERROR_LOGS_API_KEY;

    beforeAll(() => {
      process.env.ERROR_LOGS_API_KEY = 'webhook-key';
    });

    afterAll(() => {
      process.env.ERROR_LOGS_API_KEY = originalApiKey;
    });

    const listIncidents = (query: Record<string, string>) =>
      http()
        .get('/incidents')
        .query(query)
        .set('Authorization', `Bearer ${clientToken()}`);
    const listErrorLogs = (query: Record<string, string>) =>
      http()
        .get('/incidents/error-logs')
        .query(query)
        .set('x-api-key', 'webhook-key');

    it.each<Record<string, string>>([
      { pageSize: '101' },
      { pageSize: '0' },
      { pageSize: '-5' },
      { pageSize: 'abc' },
      { page: '0' },
      { page: '1.5' },
      { page: 'abc' },
    ])('rejects the incident list query %j', async (query) => {
      await listIncidents(query).expect(400);

      expect(incidentsService.getIncidents).not.toHaveBeenCalled();
    });

    it('passes numeric page and pageSize to the service', async () => {
      await listIncidents({ page: '2', pageSize: '50' }).expect(200);

      expect(incidentsService.getIncidents).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 50 }),
        expect.anything(),
      );
    });

    it('accepts the maximum page size of 100', async () => {
      await listIncidents({ pageSize: '100' }).expect(200);
    });

    it('caps the error log page size at 500', async () => {
      await listErrorLogs({ pageSize: '501' }).expect(400);
      await listErrorLogs({ pageSize: '500' }).expect(200);

      expect(incidentsService.getErrorLogs).toHaveBeenCalledTimes(1);
    });
  });
});
