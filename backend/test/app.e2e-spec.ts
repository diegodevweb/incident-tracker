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

type IncidentSla = {
  cycle: string;
  state: string;
  priority: string;
  target: string;
  respondedAt: string | null;
};

type IncidentDetail = IncidentSummary & {
  status: string;
  /** Nulo nos chamados N1, que não têm prazo da equipe. */
  sla: IncidentSla | null;
  n1ClassifiedAt: string | null;
  deletionReason: string | null;
  deletedBy: { id: number; name: string } | null;
  canDelete: boolean;
  attachments: { url: string; filename: string; category: string }[];
  events: { type: string; actorName: string | null }[];
  comments: { message: string; authorName: string; authorRole: string }[];
};

type Page = {
  items: (IncidentSummary & { sla: IncidentSla | null })[];
  total: number;
};

type NotificationList = {
  unreadCount: number;
  items: {
    type: string;
    incident: { id: number; title: string; source: string };
  }[];
};

type MonthlyReport = {
  entries: { incidentId: number; slaState: string | null; n1: boolean }[];
};

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

  const listIncidents = async (
    token: string,
    query: Record<string, string> = {},
  ) =>
    bodyOf<Page>(
      await http()
        .get('/incidents')
        .query(query)
        .set(bearer(token))
        .expect(200),
    );

  const notificationsOf = async (token: string) =>
    bodyOf<NotificationList>(
      await http().get('/notifications').set(bearer(token)).expect(200),
    );

  /** O cliente abre com criticidade e um print, como o painel exige. */
  const openIncident = async (token: string, title: string) =>
    bodyOf<{ data: IncidentDetail }>(
      await http()
        .post('/incidents')
        .set(bearer(token))
        .field('title', title)
        .field('description', `${title}: detalhes`)
        .field('environment', 'production')
        .field('priority', 'CRITICAL')
        .attach('attachments', png, {
          filename: 'print.png',
          contentType: 'image/png',
        })
        .expect(201),
    ).data;

  const reportEntry = async (incidentId: number) => {
    const report = bodyOf<MonthlyReport>(
      await http()
        .get('/incidents/reports/monthly')
        .query({
          startDate: new Date(Date.now() - 60 * 60_000).toISOString(),
          endDate: new Date(Date.now() + 60_000).toISOString(),
        })
        .set(bearer(admin.token))
        .expect(200),
    );
    return report.entries.find((entry) => entry.incidentId === incidentId);
  };

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
    // O cliente não abre chamado sem print.
    await http()
      .post('/incidents')
      .set(bearer(ana.token))
      .field('title', 'Falha ao emitir nota')
      .field('description', 'Erro 500 ao confirmar a emissão')
      .field('environment', 'production')
      .field('priority', 'ERROR')
      .expect(400);

    const { data: created } = bodyOf<{ data: IncidentSummary }>(
      await http()
        .post('/incidents')
        .set(bearer(ana.token))
        .field('title', 'Falha ao emitir nota')
        .field('description', 'Erro 500 ao confirmar a emissão')
        .field('environment', 'production')
        .field('priority', 'ERROR')
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

  it('keeps the work statuses with the admin, and records who changed the status', async () => {
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

  it('lets the client resolve and reopen, but not write the corrective action', async () => {
    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(ana.token))
      .send({ correctiveActions: 'Reiniciei o servidor' })
      .expect(403);

    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(carla.token))
      .send({ status: 'RESOLVED' })
      .expect(404);

    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(bruno.token))
      .send({ status: 'RESOLVED' })
      .expect(200);
    expect((await getIncident(incidentId, ana.token)).events).toContainEqual(
      expect.objectContaining({
        type: 'INCIDENT_RESOLVED',
        actorName: bruno.name,
      }),
    );

    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(ana.token))
      .send({ status: 'OPEN' })
      .expect(200);

    const detail = await getIncident(incidentId, admin.token);
    expect(detail.status).toBe('OPEN');
    expect(detail.events).toContainEqual(
      expect.objectContaining({ type: 'STATUS_CHANGED', actorName: ana.name }),
    );
  });

  it('lets the client attach evidence after opening the incident', async () => {
    await http()
      .post(`/incidents/${incidentId}/attachments`)
      .set(bearer(carla.token))
      .attach('attachments', png, {
        filename: 'intrusa.png',
        contentType: 'image/png',
      })
      .expect(404);

    const updated = bodyOf<IncidentDetail>(
      await http()
        .post(`/incidents/${incidentId}/attachments`)
        .set(bearer(bruno.token))
        .attach('attachments', png, {
          filename: 'de-novo.png',
          contentType: 'image/png',
        })
        .expect(201),
    );

    const evidence = updated.attachments.find(
      (attachment) => attachment.filename === 'de-novo.png',
    );
    expect(evidence).toMatchObject({ category: 'GENERAL' });
    expect(updated.attachments).toHaveLength(2);
    expect(updated.events).toContainEqual(
      expect.objectContaining({
        type: 'ATTACHMENT_ADDED',
        actorName: bruno.name,
      }),
    );

    const download = await fetch(evidence!.url);
    expect(download.status).toBe(200);
  });

  it('lets the client reply only after the first admin message', async () => {
    const write = (token: string, message: string) =>
      http()
        .post(`/incidents/${incidentId}/comments`)
        .set(bearer(token))
        .send({ message });

    await write(ana.token, 'Alguma novidade?').expect(403);
    await write(carla.token, 'Oi').expect(404);
    await write(admin.token, 'Estamos verificando').expect(201);
    await write(carla.token, 'Oi').expect(404);
    await write(bruno.token, 'Voltou a acontecer agora há pouco').expect(201);

    const detail = await getIncident(incidentId, ana.token);
    expect(detail.comments).toEqual([
      expect.objectContaining({
        message: 'Estamos verificando',
        authorName: admin.name,
        authorRole: 'ADMIN',
      }),
      expect.objectContaining({
        message: 'Voltou a acontecer agora há pouco',
        authorName: bruno.name,
        authorRole: 'CLIENT',
      }),
    ]);
    expect(JSON.stringify(detail)).not.toContain(admin.email);
  });

  it('tells the users of the company what the admin did, each one marking their own as read', async () => {
    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(ana.token))
      .send({ priority: 'CRITICAL' })
      .expect(403);
    await http()
      .patch(`/incidents/${incidentId}`)
      .set(bearer(admin.token))
      .send({ priority: 'CRITICAL' })
      .expect(200);

    // Status em andamento, a mensagem e a criticidade, todos pelo admin. O que
    // os próprios clientes fizeram (resolver, reabrir, responder) não avisa.
    const seenByBruno = await notificationsOf(bruno.token);
    expect(seenByBruno.unreadCount).toBe(3);
    expect(seenByBruno.items.map((item) => item.type)).toEqual([
      'PRIORITY_CHANGED',
      'COMMENT_ADDED',
      'STATUS_CHANGED',
    ]);
    expect(seenByBruno.items[0].incident).toEqual({
      id: incidentId,
      title: 'Falha ao emitir nota',
      source: 'DASHBOARD',
    });
    expect((await notificationsOf(carla.token)).items).toEqual([]);
    expect((await notificationsOf(admin.token)).items).toEqual([]);

    const marked = bodyOf<{ unreadCount: number }>(
      await http()
        .post('/notifications/read')
        .set(bearer(bruno.token))
        .send({ incidentId })
        .expect(200),
    );
    expect(marked.unreadCount).toBe(0);
    expect((await notificationsOf(ana.token)).unreadCount).toBe(3);
  });

  it('runs the first response SLA until the first admin answer', async () => {
    const { data: created } = bodyOf<{ data: IncidentDetail }>(
      await http()
        .post('/incidents')
        .set(bearer(carla.token))
        .field('title', 'Emissão parada')
        .field('description', 'Nenhuma nota sai desde as 9h')
        .field('environment', 'production')
        .field('priority', 'CRITICAL')
        .attach('attachments', png, {
          filename: 'parada.png',
          contentType: 'image/png',
        })
        .expect(201),
    );
    // Recém-aberto, sobra o prazo inteiro, a qualquer hora do dia.
    expect(created.sla).toMatchObject({
      state: 'ON_TIME',
      priority: 'CRITICAL',
      target: 'até 2h úteis',
      respondedAt: null,
    });

    const listed = (await listIncidents(carla.token)).items.find(
      (item) => item.id === created.id,
    );
    expect(listed?.sla).toMatchObject({ state: 'ON_TIME' });

    // Mudar só a criticidade não é resposta: o prazo passa a seguir a nova.
    await http()
      .patch(`/incidents/${created.id}`)
      .set(bearer(admin.token))
      .send({ priority: 'ERROR' })
      .expect(200);
    expect((await getIncident(created.id, carla.token)).sla).toMatchObject({
      state: 'ON_TIME',
      priority: 'ERROR',
      respondedAt: null,
    });

    // A mudança de status responde, com a criticidade de antes da edição.
    await http()
      .patch(`/incidents/${created.id}`)
      .set(bearer(admin.token))
      .send({ status: 'IN_PROGRESS', priority: 'INFO' })
      .expect(200);
    const answered = await getIncident(created.id, carla.token);
    expect(answered.sla).toMatchObject({
      state: 'MET',
      priority: 'ERROR',
      target: 'até 4h úteis',
    });
    expect(answered.sla?.respondedAt).not.toBeNull();

    // Depois da resposta, nada muda o resultado.
    await http()
      .post(`/incidents/${created.id}/comments`)
      .set(bearer(admin.token))
      .send({ message: 'Normalizado' })
      .expect(201);
    expect((await getIncident(created.id, carla.token)).sla).toEqual(
      answered.sla,
    );
  });

  it('gives a reopened incident a new response deadline, keeping the first answer', async () => {
    const { id } = await openIncident(carla.token, 'Rejeição 539');
    const reply = (message: string) =>
      http()
        .post(`/incidents/${id}/comments`)
        .set(bearer(admin.token))
        .send({ message })
        .expect(201);
    const setStatus = (status: string) =>
      http()
        .patch(`/incidents/${id}`)
        .set(bearer(carla.token))
        .send({ status })
        .expect(200);

    await reply('Estamos verificando');
    await setStatus('RESOLVED');
    await setStatus('OPEN');

    // O prazo novo começa na reabertura, inteiro e sem resposta.
    expect((await getIncident(id, carla.token)).sla).toMatchObject({
      cycle: 'REOPENING',
      state: 'ON_TIME',
      target: 'até 2h úteis',
      respondedAt: null,
    });

    await reply('Voltamos a olhar');
    const answered = await getIncident(id, carla.token);
    expect(answered.sla).toMatchObject({ cycle: 'REOPENING', state: 'MET' });
    expect(answered.sla?.respondedAt).not.toBeNull();

    // O relatório segue medindo a primeira resposta.
    expect(await reportEntry(id)).toMatchObject({ slaState: 'MET', n1: false });
  });

  it('takes an N1 incident out of the team SLA and tells the company', async () => {
    const { id } = await openIncident(carla.token, 'Dúvida de cadastro');
    const classify = (token: string, n1: boolean) =>
      http().patch(`/incidents/${id}`).set(bearer(token)).send({ n1 });

    await classify(carla.token, true).expect(403);
    await classify(admin.token, true).expect(200);

    const classified = await getIncident(id, carla.token);
    expect(classified.sla).toBeNull();
    expect(classified.n1ClassifiedAt).not.toBeNull();
    expect((await notificationsOf(carla.token)).items[0]).toMatchObject({
      type: 'N1_CLASSIFIED',
      incident: { id },
    });

    const n1Ids = (await listIncidents(admin.token, { n1: 'true' })).items.map(
      (item) => item.id,
    );
    const teamIds = (
      await listIncidents(admin.token, { n1: 'false' })
    ).items.map((item) => item.id);
    expect(n1Ids).toContain(id);
    expect(teamIds).not.toContain(id);
    expect(await reportEntry(id)).toMatchObject({ slaState: null, n1: true });

    // Desfeita a classificação, o prazo da equipe volta.
    await classify(admin.token, false).expect(200);
    expect((await getIncident(id, carla.token)).sla).toMatchObject({
      cycle: 'OPENING',
    });
    expect((await notificationsOf(carla.token)).items[0].type).toBe(
      'N1_REMOVED',
    );
  });

  it('deletes incidents softly, keeping them in the trash until restored', async () => {
    const { id, canDelete } = await openIncident(
      ana.token,
      'Aberto por engano',
    );
    const remove = (token: string, reason?: string) =>
      http()
        .post(`/incidents/${id}/delete`)
        .set(bearer(token))
        .send(reason === undefined ? {} : { reason });
    const idsOf = async (token: string, query: Record<string, string> = {}) =>
      (await listIncidents(token, query)).items.map((item) => item.id);

    expect(canDelete).toBe(true);
    // O colega da mesma empresa não exclui o que não abriu.
    await remove(bruno.token, 'Duplicado').expect(403);
    await remove(ana.token).expect(400);
    await remove(ana.token, 'Aberto em duplicidade').expect(200);

    await http().get(`/incidents/${id}`).set(bearer(ana.token)).expect(404);
    await http().get(`/incidents/${id}`).set(bearer(bruno.token)).expect(404);
    expect(await idsOf(bruno.token)).not.toContain(id);
    expect(await idsOf(admin.token)).not.toContain(id);
    expect(await idsOf(admin.token, { deleted: 'true' })).toContain(id);
    await http()
      .get('/incidents')
      .query({ deleted: 'true' })
      .set(bearer(ana.token))
      .expect(403);

    // Na lixeira, o admin vê quem excluiu e por quê, e nada muda até restaurar.
    expect(await getIncident(id, admin.token)).toMatchObject({
      deletionReason: 'Aberto em duplicidade',
      deletedBy: { name: ana.name },
      canDelete: false,
    });
    await http()
      .patch(`/incidents/${id}`)
      .set(bearer(admin.token))
      .send({ status: 'IN_PROGRESS' })
      .expect(409);
    await http()
      .post(`/incidents/${id}/restore`)
      .set(bearer(ana.token))
      .expect(403);
    await http()
      .post(`/incidents/${id}/restore`)
      .set(bearer(admin.token))
      .expect(200);

    const restored = await getIncident(id, ana.token);
    expect(restored.deletionReason).toBeNull();
    expect(restored.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['INCIDENT_DELETED', 'INCIDENT_RESTORED']),
    );

    // Depois que a equipe agiu, só o admin exclui; os avisos somem junto.
    await http()
      .post(`/incidents/${id}/comments`)
      .set(bearer(admin.token))
      .send({ message: 'Pode deixar que encerramos' })
      .expect(201);
    expect((await getIncident(id, ana.token)).canDelete).toBe(false);
    await remove(ana.token, 'Não preciso mais').expect(403);
    const before = await notificationsOf(bruno.token);
    expect(before.items[0].incident.id).toBe(id);

    await remove(admin.token, 'Duplicado do chamado anterior').expect(200);
    const after = await notificationsOf(bruno.token);
    expect(after.items.map((item) => item.incident.id)).not.toContain(id);
    expect(after.unreadCount).toBe(before.unreadCount - 1);
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
