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
import {
  WebhookKeysService,
  generateWebhookKey,
} from '../webhook-keys/webhook-keys.service';
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
    addAttachments: jest.fn().mockResolvedValue({ id: 1 }),
    addComment: jest.fn().mockResolvedValue({ id: 1 }),
    getMonthlyReport: jest.fn().mockResolvedValue({}),
    getErrorLogs: jest.fn().mockResolvedValue([]),
    getErrorLog: jest.fn().mockResolvedValue({ id: 1 }),
    createErrorLog: jest.fn().mockResolvedValue({ message: 'ok' }),
    createPreventiveAction: jest.fn().mockResolvedValue({ id: 1 }),
    deleteIncident: jest.fn().mockResolvedValue({ message: 'ok' }),
    restoreIncident: jest.fn().mockResolvedValue({ id: 1 }),
  };

  // Gerada em tempo de execução: nada parecido com credencial fica no código.
  const webhookKey = generateWebhookKey().key;
  const webhookKeys = {
    authenticate: jest.fn((key?: string) =>
      Promise.resolve(key === webhookKey ? { id: 1, companyId: 2 } : null),
    ),
  };

  type FakeUser = {
    id: number;
    email: string;
    role: UserRole;
    tokenVersion: number;
    companyId: number | null;
  };
  const users = new Map<number, FakeUser>();
  const resetUsers = () => {
    users.clear();
    users.set(1, {
      id: 1,
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      tokenVersion: 0,
      companyId: null,
    });
    users.set(2, {
      id: 2,
      email: 'cliente@example.com',
      role: UserRole.CLIENT,
      tokenVersion: 0,
      companyId: 7,
    });
  };
  const prismaFake = {
    user: {
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve(users.get(where.id) ?? null),
    },
  };

  const tokenFor = (role: UserRole, secret = JWT_SECRET) =>
    jwtService.sign(
      {
        sub: role === UserRole.ADMIN ? 1 : 2,
        email: 'u@example.com',
        role,
        tv: 0,
      },
      { secret },
    );
  const http = () => request(app.getHttpServer() as Server);
  const adminToken = () => tokenFor(UserRole.ADMIN);
  const clientToken = () => tokenFor(UserRole.CLIENT);

  const monthlyQuery = {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z',
  };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
        { provide: PrismaService, useValue: prismaFake },
        { provide: IncidentsService, useValue: incidentsService },
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
    resetUsers();
  });

  describe('token validity is checked against the database', () => {
    const listIncidents = (token: string) =>
      http().get('/incidents').set('Authorization', `Bearer ${token}`);

    // O usuário rebaixado ganha uma empresa: CLIENT sem empresa nem entra.
    const demoteAdmin = () => {
      Object.assign(users.get(1)!, { role: UserRole.CLIENT, companyId: 7 });
    };

    it('uses the role stored in the database, not the one in the token', async () => {
      demoteAdmin();

      await http()
        .get('/incidents/reports/monthly')
        .query(monthlyQuery)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(403);

      expect(incidentsService.getMonthlyReport).not.toHaveBeenCalled();
    });

    it('hands the service the database role and company of a demoted user', async () => {
      demoteAdmin();

      await listIncidents(adminToken()).expect(200);

      expect(incidentsService.getIncidents).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sub: 1,
          role: UserRole.CLIENT,
          companyId: 7,
        }),
      );
    });

    it('rejects a client token once the user has no company', async () => {
      users.get(2)!.companyId = null;

      await listIncidents(clientToken()).expect(401);

      expect(incidentsService.getIncidents).not.toHaveBeenCalled();
    });

    it('rejects the token of a user that no longer exists', async () => {
      users.delete(2);

      await listIncidents(clientToken()).expect(401);

      expect(incidentsService.getIncidents).not.toHaveBeenCalled();
    });

    it('rejects a token whose version was revoked', async () => {
      users.get(2)!.tokenVersion = 1;

      await listIncidents(clientToken()).expect(401);
    });

    it('rejects a token issued before token versions existed', async () => {
      const legacyToken = jwtService.sign({
        sub: 2,
        email: 'cliente@example.com',
        role: UserRole.CLIENT,
      });

      await listIncidents(legacyToken).expect(401);
    });
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
      {
        name: 'POST /incidents/:id/restore',
        send: (token?: string) =>
          withToken(http().post('/incidents/1/restore'), token),
        handler: () => incidentsService.restoreIncident,
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

    // Quais mudanças o cliente pode fazer é regra do service (resolver ou reabrir).
    it('lets a CLIENT send a status change to the service with their own identity', async () => {
      await http()
        .patch('/incidents/1')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(incidentsService.updateIncident).toHaveBeenCalledWith(
        1,
        { status: 'RESOLVED' },
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
        [],
      );
    });

    it('lets a CLIENT attach evidence to an incident', async () => {
      await http()
        .post('/incidents/1/attachments')
        .set('Authorization', `Bearer ${clientToken()}`)
        .attach('attachments', png, 'erro.png')
        .expect(201);

      expect(incidentsService.addAttachments).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ originalname: 'erro.png' })],
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
      );
    });

    it('lets a CLIENT send a message to the service, which decides if they may reply yet', async () => {
      await http()
        .post('/incidents/1/comments')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ message: '  Voltou a acontecer hoje  ' })
        .expect(201);

      expect(incidentsService.addComment).toHaveBeenCalledWith(
        1,
        { message: 'Voltou a acontecer hoje' },
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
      );
    });

    // Se o cliente pode excluir aquele chamado é regra do service.
    it('lets a CLIENT ask to delete an incident, with the reason trimmed', async () => {
      await http()
        .post('/incidents/1/delete')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ reason: '  Aberto em duplicidade  ' })
        .expect(200);

      expect(incidentsService.deleteIncident).toHaveBeenCalledWith(
        1,
        { reason: 'Aberto em duplicidade' },
        expect.objectContaining({ role: UserRole.CLIENT, sub: 2 }),
      );
    });

    it.each([{}, { reason: '   ' }, { reason: 'x'.repeat(1001) }])(
      'refuses a deletion without a usable reason (%j)',
      async (body) => {
        await http()
          .post('/incidents/1/delete')
          .set('Authorization', `Bearer ${adminToken()}`)
          .send(body)
          .expect(400);

        expect(incidentsService.deleteIncident).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['true', true],
      ['false', false],
    ])(
      'reads n1=%s from a multipart edit as a boolean',
      async (field, value) => {
        await http()
          .patch('/incidents/1')
          .set('Authorization', `Bearer ${adminToken()}`)
          .field('n1', field)
          .expect(200);

        expect(incidentsService.updateIncident).toHaveBeenCalledWith(
          1,
          { n1: value },
          expect.anything(),
          [],
        );
      },
    );

    it('refuses an n1 value that is not a boolean', async () => {
      await http()
        .patch('/incidents/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ n1: 'sim' })
        .expect(400);

      expect(incidentsService.updateIncident).not.toHaveBeenCalled();
    });

    it('reads the n1 and trash filters of the list as booleans', async () => {
      await http()
        .get('/incidents')
        .query({ n1: 'true', deleted: 'false' })
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(incidentsService.getIncidents).toHaveBeenCalledWith(
        { n1: true, deleted: false },
        expect.anything(),
      );
    });

    it.each([
      [
        'POST /incidents/:id/delete',
        () => http().post('/incidents/1/delete').send({ reason: 'Duplicado' }),
      ],
      [
        'POST /incidents/:id/attachments',
        () => http().post('/incidents/1/attachments'),
      ],
      [
        'POST /incidents/:id/comments',
        () => http().post('/incidents/1/comments').send({ message: 'Oi' }),
      ],
    ])('%s rejects requests without a token', async (_name, send) => {
      await send().expect(401);

      expect(incidentsService.deleteIncident).not.toHaveBeenCalled();
      expect(incidentsService.addAttachments).not.toHaveBeenCalled();
      expect(incidentsService.addComment).not.toHaveBeenCalled();
    });
  });

  describe('upload and input limits', () => {
    const validTicket = {
      title: 'Erro na emissão',
      description: 'Nota rejeitada',
      environment: 'production',
    };

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

    it('rejects more evidence files than allowed in one upload', async () => {
      const req = http()
        .post('/incidents/1/attachments')
        .set('Authorization', `Bearer ${clientToken()}`);
      for (let i = 0; i <= MAX_INCIDENT_ATTACHMENTS; i++) {
        req.attach('attachments', png, `p${i}.png`);
      }

      await req.expect(400);

      expect(incidentsService.addAttachments).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty message', { message: '' }],
      ['a message of only spaces', { message: '   ' }],
      ['a message longer than the limit', { message: 'x'.repeat(10_001) }],
      ['a message with extra fields', { message: 'Oi', authorId: 1 }],
    ])('rejects %s with 400', async (_name, body) => {
      await http()
        .post('/incidents/1/comments')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send(body)
        .expect(400);

      expect(incidentsService.addComment).not.toHaveBeenCalled();
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
    const listIncidents = (query: Record<string, string>) =>
      http()
        .get('/incidents')
        .query(query)
        .set('Authorization', `Bearer ${clientToken()}`);
    const listErrorLogs = (query: Record<string, string>) =>
      http()
        .get('/incidents/error-logs')
        .query(query)
        .set('x-api-key', webhookKey);

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

  describe('webhook routes', () => {
    const errorLog = {
      title: 'Falha',
      description: 'Falha na integração',
      message: 'timeout',
      environment: 'production',
    };
    const postErrorLog = (body: Record<string, unknown>, key?: string) => {
      const call = http().post('/incidents/error-logs');
      return (key ? call.set('x-api-key', key) : call).send(body);
    };

    it('rejects requests without a key', async () => {
      await postErrorLog(errorLog).expect(401);

      expect(incidentsService.createErrorLog).not.toHaveBeenCalled();
    });

    it('rejects an unknown key', async () => {
      await postErrorLog(errorLog, generateWebhookKey().key).expect(401);

      expect(incidentsService.createErrorLog).not.toHaveBeenCalled();
    });

    it('does not accept a user token in place of the key', async () => {
      await http()
        .post('/incidents/error-logs')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(errorLog)
        .expect(401);
    });

    it("hands the key's company to the service", async () => {
      await postErrorLog(errorLog, webhookKey).expect(201);

      expect(incidentsService.createErrorLog).toHaveBeenCalledWith(errorLog, {
        id: 1,
        companyId: 2,
      });
    });

    it.each([
      ['clientId', 3],
      ['companyId', 3],
      ['source', 'DASHBOARD'],
      ['status', 'RESOLVED'],
    ])('rejects %s in the body', async (field, value) => {
      await postErrorLog({ ...errorLog, [field]: value }, webhookKey).expect(
        400,
      );

      expect(incidentsService.createErrorLog).not.toHaveBeenCalled();
    });

    it("reads logs only within the key's company", async () => {
      await http()
        .get('/incidents/error-log/5')
        .set('x-api-key', webhookKey)
        .expect(200);
      await http()
        .get('/incidents/error-logs')
        .set('x-api-key', webhookKey)
        .expect(200);

      expect(incidentsService.getErrorLog).toHaveBeenCalledWith(5, 2);
      expect(incidentsService.getErrorLogs).toHaveBeenCalledWith(
        expect.anything(),
        2,
      );
    });
  });
});
