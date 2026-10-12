import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { generateTemporaryPassword, hashPassword } from '../src/auth/passwords';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A API inteira contra MySQL e S3 de verdade: migrations aplicadas, módulos
 * reais, nada de dublê. Cada execução cria os próprios usuários (e-mails
 * aleatórios), então pode rodar de novo no mesmo banco; mas o banco precisa
 * ser descartável, nunca o de desenvolvimento.
 *
 * Variáveis: DATABASE_URL, JWT_SECRET e STORAGE_* (ver .env.example).
 */
function assertDisposableDatabase() {
  const url = process.env.DATABASE_URL;
  const database = url ? new URL(url).pathname.slice(1) : '';

  if (!/(e2e|test)/i.test(database)) {
    throw new Error(
      `Os testes e2e gravam no banco: use um DATABASE_URL descartável, com "e2e" ou "test" no nome (atual: "${database}")`,
    );
  }
}

// O upload só confere a assinatura do PNG; o resto pode ser qualquer coisa.
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type Session = {
  accessToken: string;
  user: { id: number; mustChangePassword: boolean };
};

type IncidentSummary = { id: number; clientId: number };

type IncidentDetail = IncidentSummary & {
  status: string;
  attachments: { url: string }[];
  events: { type: string; actorName: string | null }[];
};

const bodyOf = <T>(response: { body: unknown }) => response.body as T;

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  const run = randomBytes(4).toString('hex');
  const png = Buffer.concat([PNG_SIGNATURE, randomBytes(64)]);

  const admin = { email: `e2e-admin-${run}@example.test`, password: '' };
  const client = {
    id: 0,
    email: `e2e-cliente-${run}@example.test`,
    password: '',
  };
  let adminToken = '';
  let clientToken = '';
  let incidentId = 0;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string, password: string) =>
    bodyOf<Session>(
      await http().post('/auth/login').send({ email, password }).expect(201),
    );

  const getIncident = async (id: number, token: string) =>
    bodyOf<IncidentDetail>(
      await http().get(`/incidents/${id}`).set(bearer(token)).expect(200),
    );

  beforeAll(async () => {
    assertDisposableDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleRef.createNestApplication<NestExpressApplication>(),
    );
    await app.init();

    // O primeiro admin não tem rota (em produção sai de um comando no deploy).
    admin.password = generateTemporaryPassword(admin.email);
    await app.get(PrismaService).user.create({
      data: {
        name: 'Admin e2e',
        email: admin.email,
        password: await hashPassword(admin.password),
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers the healthcheck with the database up', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
  });

  it('requires a token on protected routes', async () => {
    await http().get('/incidents').expect(401);
    await http().get('/clients').expect(401);
  });

  it('lets the admin register a client with a temporary password', async () => {
    adminToken = (await login(admin.email, admin.password)).accessToken;

    const created = bodyOf<{
      client: { id: number };
      temporaryPassword: string;
    }>(
      await http()
        .post('/clients')
        .set(bearer(adminToken))
        .send({ name: 'Cliente e2e', email: client.email })
        .expect(201),
    );

    client.id = created.client.id;
    client.password = created.temporaryPassword;
    expect(client.password).toHaveLength(24);
  });

  it('only lets a client with a temporary password change it', async () => {
    const pending = await login(client.email, client.password);
    expect(pending.user.mustChangePassword).toBe(true);

    const blocked = await http()
      .get('/incidents')
      .set(bearer(pending.accessToken))
      .expect(403);
    expect(blocked.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    const newPassword = generateTemporaryPassword(client.email);
    const changed = bodyOf<Session>(
      await http()
        .post('/account/password')
        .set(bearer(pending.accessToken))
        .send({ currentPassword: client.password, newPassword })
        .expect(200),
    );

    client.password = newPassword;
    clientToken = changed.accessToken;
    expect(changed.user.mustChangePassword).toBe(false);

    // A troca derruba o token antigo e emite um novo.
    await http().get('/account').set(bearer(pending.accessToken)).expect(401);
    await http().get('/incidents').set(bearer(clientToken)).expect(200);
  });

  it('stores an uploaded print and serves it back through a signed URL', async () => {
    const { data: created } = bodyOf<{ data: IncidentSummary }>(
      await http()
        .post('/incidents')
        .set(bearer(clientToken))
        .field('title', 'Falha ao emitir nota')
        .field('description', 'Erro 500 ao confirmar a emissão')
        .field('environment', 'production')
        .attach('attachments', png, {
          filename: 'print.png',
          contentType: 'image/png',
        })
        .expect(201),
    );

    incidentId = created.id;
    expect(created.clientId).toBe(client.id);

    const detail = await getIncident(incidentId, clientToken);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.events.map((event) => event.type)).toContain(
      'INCIDENT_CREATED',
    );

    const download = await fetch(detail.attachments[0].url);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(png);
  });

  it('lets only the admin change the status, and records who did it', async () => {
    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(clientToken))
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(adminToken))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const detail = await getIncident(incidentId, clientToken);
    expect(detail.status).toBe('IN_PROGRESS');
    expect(detail.events).toContainEqual(
      expect.objectContaining({
        type: 'STATUS_CHANGED',
        actorName: 'Admin e2e',
      }),
    );
    expect(JSON.stringify(detail)).not.toContain(admin.email);
  });

  it('opens incidents from the webhook only for the key owner', async () => {
    const { key } = bodyOf<{ key: string }>(
      await http()
        .post(`/clients/${client.id}/webhook-keys`)
        .set(bearer(adminToken))
        .send({ name: 'Integração e2e' })
        .expect(201),
    );

    const errorLog = {
      title: 'Timeout no gateway',
      description: 'Pagamento sem resposta',
      message: 'ETIMEDOUT',
      environment: 'production',
    };

    await http().post('/incidents/error-logs').send(errorLog).expect(401);

    const created = await http()
      .post('/incidents/error-logs')
      .set('x-api-key', key)
      .send(errorLog)
      .expect(201);

    expect(created.body).toMatchObject({
      data: { clientId: client.id, source: 'WEBHOOK', status: 'OPEN' },
    });
  });

  it("lists only the client's own incidents, paginated", async () => {
    const page = bodyOf<{ items: IncidentSummary[]; total: number }>(
      await http().get('/incidents').set(bearer(clientToken)).expect(200),
    );

    expect(page.total).toBe(2);
    expect(page.items.map((incident) => incident.clientId)).toEqual([
      client.id,
      client.id,
    ]);
  });

  it('revokes the token on logout', async () => {
    await http().post('/auth/logout').set(bearer(clientToken)).expect(204);
    await http().get('/incidents').set(bearer(clientToken)).expect(401);
  });
});
