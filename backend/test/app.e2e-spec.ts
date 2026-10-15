import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { generateTemporaryPassword } from '../src/auth/passwords';
import { CreateAdminError, createAdmin } from '../src/cli/create-admin';
import { isValidCnpj } from '../src/companies/cnpj';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A API inteira contra MySQL e S3 de verdade: migrations aplicadas, módulos
 * reais, nada de dublê. Cada execução cria os próprios usuários e empresas
 * (e-mails e CNPJ aleatórios), então pode rodar de novo no mesmo banco; mas o
 * banco precisa ser descartável, nunca o de desenvolvimento.
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

/** CNPJ alfanumérico válido a partir de 12 caracteres: só um par de dígitos fecha. */
function cnpjFrom(base: string) {
  const cnpj = Array.from(
    { length: 100 },
    (_, digits) => `${base}${String(digits).padStart(2, '0')}`,
  ).find(isValidCnpj);

  if (!cnpj) {
    throw new Error(`Nenhum dígito verificador fecha para ${base}`);
  }

  return cnpj;
}

// O upload só confere a assinatura do PNG; o resto pode ser qualquer coisa.
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type Session = {
  accessToken: string;
  user: { id: number; mustChangePassword: boolean };
};

type Company = { id: number; cnpj: string | null; disabledAt: string | null };

type IncidentSummary = {
  id: number;
  companyId: number;
  company: { id: number; name: string };
  createdBy: { id: number; name: string } | null;
};

type IncidentDetail = IncidentSummary & {
  status: string;
  attachments: { url: string }[];
  events: { type: string; actorName: string | null }[];
};

type Page = { items: IncidentSummary[]; total: number };

type Account = {
  name: string;
  email: string;
  password: string;
  token: string;
};

const bodyOf = <T>(response: { body: unknown }) => response.body as T;

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  const run = randomBytes(4).toString('hex');
  const png = Buffer.concat([PNG_SIGNATURE, randomBytes(64)]);
  const account = (name: string, slug: string): Account => ({
    name,
    email: `e2e-${slug}-${run}@example.test`,
    password: '',
    token: '',
  });

  const admin = account('Admin e2e', 'admin');
  // Ana e Bruno na empresa Alfa; Carla na Beta.
  const ana = account('Ana e2e', 'ana');
  const bruno = account('Bruno e2e', 'bruno');
  const carla = account('Carla e2e', 'carla');
  const alfaCnpj = cnpjFrom(`E2E${run.toUpperCase()}1`);
  let alfa: Company;
  let beta: Company;
  let incidentId = 0;
  let webhookKey = '';

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

  const listIncidents = async (token: string) =>
    bodyOf<Page>(await http().get('/incidents').set(bearer(token)).expect(200));

  const createCompany = async (body: Record<string, unknown>) =>
    bodyOf<Company>(
      await http()
        .post('/companies')
        .set(bearer(admin.token))
        .send(body)
        .expect(201),
    );

  const createUser = async (company: Company, user: Account) => {
    const created = bodyOf<{ temporaryPassword: string }>(
      await http()
        .post(`/companies/${company.id}/users`)
        .set(bearer(admin.token))
        .send({ name: user.name, email: user.email })
        .expect(201),
    );
    user.password = created.temporaryPassword;
  };

  /** Troca a senha temporária e guarda o token novo. */
  const activate = async (user: Account) => {
    const pending = await login(user.email, user.password);
    const newPassword = generateTemporaryPassword(user.email);
    const changed = bodyOf<Session>(
      await http()
        .post('/account/password')
        .set(bearer(pending.accessToken))
        .send({ currentPassword: user.password, newPassword })
        .expect(200),
    );

    user.password = newPassword;
    user.token = changed.accessToken;
    return { pending, changed };
  };

  beforeAll(async () => {
    assertDisposableDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleRef.createNestApplication<NestExpressApplication>(),
    );
    await app.init();

    // O primeiro admin não tem rota: em produção sai do comando create-admin,
    // que usa esta mesma função.
    admin.password = generateTemporaryPassword(admin.email);
    await createAdmin(app.get(PrismaService), admin);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers the healthcheck with the database up', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
  });

  it('requires a token on protected routes', async () => {
    await http().get('/incidents').expect(401);
    await http().get('/companies').expect(401);
  });

  it('creates the first admin with the chosen password and refuses a repeated e-mail', async () => {
    const session = await login(admin.email, admin.password);

    // A senha foi escolhida, não é temporária; e o admin alcança rotas de admin.
    expect(session.user.mustChangePassword).toBe(false);
    await http().get('/companies').set(bearer(session.accessToken)).expect(200);

    await expect(
      createAdmin(app.get(PrismaService), {
        name: 'Outro nome',
        email: admin.email.toUpperCase(),
        password: generateTemporaryPassword(admin.email),
      }),
    ).rejects.toThrow(CreateAdminError);
    // Nada mudou: a senha original continua valendo.
    await login(admin.email, admin.password);
  });

  it('lets the admin register companies, with a normalized alphanumeric CNPJ', async () => {
    admin.token = (await login(admin.email, admin.password)).accessToken;

    alfa = await createCompany({
      name: `Alfa ${run}`,
      cnpj: alfaCnpj.toLowerCase(),
    });
    beta = await createCompany({ name: `Beta ${run}` });

    expect(alfa.cnpj).toBe(alfaCnpj);
    expect(beta.cnpj).toBeNull();

    // O mesmo CNPJ não entra duas vezes.
    await http()
      .post('/companies')
      .set(bearer(admin.token))
      .send({ name: 'Cópia', cnpj: alfaCnpj })
      .expect(409);
  });

  it('only lets a user with a temporary password change it', async () => {
    await createUser(alfa, ana);
    await createUser(alfa, bruno);
    await createUser(beta, carla);
    expect(ana.password).toHaveLength(24);

    const pending = await login(ana.email, ana.password);
    expect(pending.user.mustChangePassword).toBe(true);

    const blocked = await http()
      .get('/incidents')
      .set(bearer(pending.accessToken))
      .expect(403);
    expect(blocked.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    const { changed } = await activate(ana);
    expect(changed.user.mustChangePassword).toBe(false);

    // A troca derruba o token antigo e emite um novo.
    await http().get('/account').set(bearer(pending.accessToken)).expect(401);
    await activate(bruno);
    await activate(carla);
  });

  it('stores an uploaded print and serves it back through a signed URL', async () => {
    const { data: created } = bodyOf<{ data: IncidentSummary }>(
      await http()
        .post('/incidents')
        .set(bearer(ana.token))
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
    expect(created.companyId).toBe(alfa.id);
    expect(created.createdBy).toMatchObject({ name: ana.name });

    const detail = await getIncident(incidentId, ana.token);
    expect(detail.attachments).toHaveLength(1);

    const download = await fetch(detail.attachments[0].url);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(png);
  });

  it('shows the incident to every user of the company, and only to them', async () => {
    const seenByCoworker = await getIncident(incidentId, bruno.token);
    expect(seenByCoworker.createdBy).toEqual({
      id: expect.any(Number) as number,
      name: ana.name,
    });
    expect((await listIncidents(bruno.token)).items.map((i) => i.id)).toEqual([
      incidentId,
    ]);

    await http()
      .get(`/incidents/${incidentId}`)
      .set(bearer(carla.token))
      .expect(404);
    expect((await listIncidents(carla.token)).total).toBe(0);
  });

  it('lets only the admin change the status, and records who did it', async () => {
    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(ana.token))
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(admin.token))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const detail = await getIncident(incidentId, bruno.token);
    expect(detail.status).toBe('IN_PROGRESS');
    expect(detail.events).toContainEqual(
      expect.objectContaining({
        type: 'STATUS_CHANGED',
        actorName: admin.name,
      }),
    );
    expect(JSON.stringify(detail)).not.toContain(admin.email);
  });

  it("opens incidents from the webhook for the key's company", async () => {
    const created = bodyOf<{ key: string }>(
      await http()
        .post(`/companies/${alfa.id}/webhook-keys`)
        .set(bearer(admin.token))
        .send({ name: 'Integração e2e' })
        .expect(201),
    );
    webhookKey = created.key;

    const errorLog = {
      title: 'Timeout no gateway',
      description: 'Pagamento sem resposta',
      message: 'ETIMEDOUT',
      environment: 'production',
    };

    await http().post('/incidents/error-logs').send(errorLog).expect(401);

    const response = await http()
      .post('/incidents/error-logs')
      .set('x-api-key', webhookKey)
      .send(errorLog)
      .expect(201);

    expect(response.body).toMatchObject({
      data: { companyId: alfa.id, source: 'WEBHOOK', status: 'OPEN' },
    });

    // A empresa inteira vê o chamado do webhook.
    const page = await listIncidents(bruno.token);
    expect(page.total).toBe(2);
    expect(page.items.map((incident) => incident.companyId)).toEqual([
      alfa.id,
      alfa.id,
    ]);
  });

  it('makes the admin pick an existing company to open an incident', async () => {
    const body = {
      title: 'Aberto pelo suporte',
      description: 'Contato por telefone',
      environment: 'production',
    };

    await http()
      .post('/incidents')
      .set(bearer(admin.token))
      .send(body)
      .expect(400);

    const { data: created } = bodyOf<{ data: IncidentSummary }>(
      await http()
        .post('/incidents')
        .set(bearer(admin.token))
        .send({ ...body, companyId: beta.id })
        .expect(201),
    );

    const seenByCarla = await getIncident(created.id, carla.token);
    expect(seenByCarla.createdBy).toMatchObject({ name: admin.name });
    expect(JSON.stringify(seenByCarla)).not.toContain(admin.email);
  });

  it("disabling a company locks out its users and its keys, and nobody else's", async () => {
    await http()
      .post(`/companies/${alfa.id}/disable`)
      .set(bearer(admin.token))
      .expect(200);

    await http().get('/incidents').set(bearer(ana.token)).expect(401);
    await http().get('/incidents').set(bearer(bruno.token)).expect(401);
    await http()
      .post('/auth/login')
      .send({ email: ana.email, password: ana.password })
      .expect(403);
    await http()
      .get('/incidents/error-logs')
      .set('x-api-key', webhookKey)
      .expect(401);
    await http().get('/incidents').set(bearer(carla.token)).expect(200);

    await http()
      .post(`/companies/${alfa.id}/enable`)
      .set(bearer(admin.token))
      .expect(200);

    // Sessões antigas continuam encerradas; um login novo volta a funcionar.
    await http().get('/incidents').set(bearer(ana.token)).expect(401);
    ana.token = (await login(ana.email, ana.password)).accessToken;
    expect((await listIncidents(ana.token)).total).toBe(2);
    await http()
      .get('/incidents/error-logs')
      .set('x-api-key', webhookKey)
      .expect(200);
  });

  it('revokes the token on logout', async () => {
    await http().post('/auth/logout').set(bearer(carla.token)).expect(204);
    await http().get('/incidents').set(bearer(carla.token)).expect(401);
  });
});
