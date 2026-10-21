import {
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  UserRole,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

const admin: JwtPayload = {
  sub: 1,
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  companyId: null,
};
const client: JwtPayload = {
  sub: 2,
  email: 'cliente@example.com',
  role: UserRole.CLIENT,
  companyId: 7,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const png = {
  buffer: PNG,
  originalname: 'print.png',
  mimetype: 'image/png',
  size: PNG.length,
};

// Horário de Brasília (UTC-3).
const brt = (local: string) => new Date(`${local}:00-03:00`);

type WriteArg = { data: Record<string, unknown> };
type FindManyArg = { select?: unknown; include?: unknown; where?: unknown };

describe('IncidentsService first response SLA', () => {
  let prisma: {
    incident: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    incidentComment: { count: jest.Mock };
    user: { findMany: jest.Mock };
    company: { findUnique: jest.Mock };
    preventiveAction: { findMany: jest.Mock };
  };
  let service: IncidentsService;

  // Alta (4h úteis) aberto às 10h de quinta: vence às 14h.
  const incidentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    companyId: 7,
    title: 'Erro',
    description: 'Descrição',
    correctiveActions: null,
    status: IncidentStatus.OPEN,
    priority: IncidentLevel.ERROR,
    source: IncidentSource.DASHBOARD,
    environment: 'production',
    createdAt: brt('2026-10-15T10:00'),
    updatedAt: brt('2026-10-15T10:00'),
    firstRespondedAt: null,
    responsePriority: null,
    reopenedAt: null,
    reopenRespondedAt: null,
    reopenResponsePriority: null,
    n1ClassifiedAt: null,
    deletedAt: null,
    company: { id: 7, name: 'Alfa' },
    createdBy: { id: 2, name: 'Cliente' },
    attachments: [],
    logs: [],
    events: [],
    comments: [],
    ...overrides,
  });

  const stored = (overrides: Record<string, unknown> = {}) =>
    prisma.incident.findUnique.mockResolvedValue(incidentRow(overrides));

  const writeOf = (mock: jest.Mock) => {
    const calls = mock.mock.calls as [WriteArg][];
    return calls[calls.length - 1][0].data;
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: brt('2026-10-15T11:00') });
    prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue(incidentRow()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(incidentRow()),
        create: jest.fn().mockResolvedValue(incidentRow()),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      incidentComment: { count: jest.fn().mockResolvedValue(1) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 7 }) },
      preventiveAction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const storage = {
      uploadObject: jest.fn(({ key }: { key: string }) =>
        Promise.resolve({ key }),
      ),
      deleteObject: jest.fn(),
      getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    };
    service = new IncidentsService(prisma as unknown as PrismaService, storage);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('recording the first response', () => {
    it('takes an admin status change, keeping the priority from before the edit', async () => {
      await service.updateIncident(
        10,
        {
          status: IncidentStatus.IN_PROGRESS,
          priority: IncidentLevel.CRITICAL,
        },
        admin,
      );

      expect(writeOf(prisma.incident.update)).toMatchObject({
        status: IncidentStatus.IN_PROGRESS,
        priority: IncidentLevel.CRITICAL,
        firstRespondedAt: brt('2026-10-15T11:00'),
        responsePriority: IncidentLevel.ERROR,
      });
    });

    it('takes an admin comment', async () => {
      await service.addComment(10, { message: 'Estamos verificando' }, admin);

      expect(writeOf(prisma.incident.update)).toMatchObject({
        firstRespondedAt: brt('2026-10-15T11:00'),
        responsePriority: IncidentLevel.ERROR,
      });
    });

    it.each([
      ['a priority change', { priority: IncidentLevel.CRITICAL }],
      ['a corrective action', { correctiveActions: 'Ajuste no cadastro' }],
      [
        'a save that keeps the status',
        { status: IncidentStatus.OPEN, correctiveActions: 'Ajuste' },
      ],
    ])('does not take %s by an admin', async (_case, data) => {
      await service.updateIncident(10, data, admin);

      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );
    });

    it('does not take what the client does', async () => {
      await service.updateIncident(
        10,
        { status: IncidentStatus.RESOLVED },
        client,
      );
      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );

      await service.addComment(10, { message: 'Alguma novidade?' }, client);
      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );
    });

    it('keeps the first response once there is one', async () => {
      stored({
        firstRespondedAt: brt('2026-10-15T10:30'),
        responsePriority: IncidentLevel.ERROR,
      });

      await service.updateIncident(
        10,
        { status: IncidentStatus.IN_PROGRESS },
        admin,
      );
      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );

      await service.addComment(10, { message: 'Mais uma coisa' }, admin);
      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );
    });

    it('treats an incident opened by an admin as answered at opening', async () => {
      await service.createIncident(
        {
          title: 'Erro',
          description: 'Descrição',
          environment: 'production',
          priority: IncidentLevel.WARNING,
          companyId: 7,
        },
        [],
        admin,
      );

      const data = writeOf(prisma.incident.create);
      expect(data).toMatchObject({
        createdAt: brt('2026-10-15T11:00'),
        firstRespondedAt: brt('2026-10-15T11:00'),
        responsePriority: IncidentLevel.WARNING,
      });
    });

    it('starts the clock of an incident opened by a client', async () => {
      await service.createIncident(
        {
          title: 'Erro',
          description: 'Descrição',
          environment: 'production',
          priority: IncidentLevel.WARNING,
        },
        [png],
        client,
      );

      const data = writeOf(prisma.incident.create);
      expect(data).not.toHaveProperty('firstRespondedAt');
      expect(data).not.toHaveProperty('responsePriority');
    });
  });

  describe('reopening', () => {
    const resolvedAnswered = {
      status: IncidentStatus.RESOLVED,
      firstRespondedAt: brt('2026-10-15T10:30'),
      responsePriority: IncidentLevel.ERROR,
    };

    it('starts a new deadline, still unanswered, when the client reopens', async () => {
      stored(resolvedAnswered);

      await service.updateIncident(10, { status: IncidentStatus.OPEN }, client);

      const data = writeOf(prisma.incident.update);
      expect(data).toMatchObject({
        reopenedAt: brt('2026-10-15T11:00'),
        reopenRespondedAt: null,
        reopenResponsePriority: null,
      });
      expect(data).not.toHaveProperty('firstRespondedAt');
    });

    it('counts a reopening by an admin as answered at once, with the priority from before the edit', async () => {
      stored(resolvedAnswered);

      await service.updateIncident(
        10,
        {
          status: IncidentStatus.IN_PROGRESS,
          priority: IncidentLevel.CRITICAL,
        },
        admin,
      );

      expect(writeOf(prisma.incident.update)).toMatchObject({
        reopenedAt: brt('2026-10-15T11:00'),
        reopenRespondedAt: brt('2026-10-15T11:00'),
        reopenResponsePriority: IncidentLevel.ERROR,
      });
    });

    it('leaves the first response closed when the client had resolved before it', async () => {
      // Resolvido pelo cliente sem resposta e reaberto pelo admin: o prazo
      // novo é o da reabertura, e a primeira resposta segue encerrada.
      stored({ status: IncidentStatus.RESOLVED });

      await service.updateIncident(10, { status: IncidentStatus.OPEN }, admin);

      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'firstRespondedAt',
      );
    });

    it.each([
      [
        'a message',
        () => service.addComment(10, { message: 'Vamos olhar' }, admin),
      ],
      [
        'a status change',
        () =>
          service.updateIncident(
            10,
            { status: IncidentStatus.IN_PROGRESS },
            admin,
          ),
      ],
    ])(
      'takes %s by an admin as the answer to the reopening',
      async (_case, act) => {
        stored({
          firstRespondedAt: null,
          reopenedAt: brt('2026-10-15T10:00'),
        });

        await act();

        const data = writeOf(prisma.incident.update);
        expect(data).toMatchObject({
          reopenRespondedAt: brt('2026-10-15T11:00'),
          reopenResponsePriority: IncidentLevel.ERROR,
        });
        expect(data).not.toHaveProperty('firstRespondedAt');
      },
    );

    it('keeps the answer to the reopening once there is one', async () => {
      stored({
        ...resolvedAnswered,
        status: IncidentStatus.OPEN,
        reopenedAt: brt('2026-10-15T10:00'),
        reopenRespondedAt: brt('2026-10-15T10:20'),
      });

      await service.addComment(10, { message: 'Mais uma coisa' }, admin);

      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'reopenRespondedAt',
      );
    });

    it('does not take a message on a resolved incident as an answer', async () => {
      // O relógio parou quando o chamado foi resolvido.
      stored({ status: IncidentStatus.RESOLVED });

      await service.addComment(10, { message: 'Ficou resolvido?' }, admin);

      const data = writeOf(prisma.incident.update);
      expect(data).not.toHaveProperty('firstRespondedAt');
      expect(data).not.toHaveProperty('reopenRespondedAt');
    });

    it('shows the deadline of the reopening on the incident', async () => {
      // Alta (4h) reaberta às 10h30, sem resposta: vence às 14h30.
      stored({
        ...resolvedAnswered,
        status: IncidentStatus.OPEN,
        reopenedAt: brt('2026-10-15T10:30'),
      });

      const incident = await service.getIncident(10, client);

      expect(incident.sla).toMatchObject({
        cycle: 'REOPENING',
        startedAt: brt('2026-10-15T10:30'),
        state: 'ON_TIME',
        dueAt: brt('2026-10-15T14:30'),
        remainingMinutes: 210,
      });
    });
  });

  describe('N1', () => {
    it('has no deadline of the team', async () => {
      stored({ n1ClassifiedAt: brt('2026-10-15T10:10') });

      const incident = await service.getIncident(10, client);

      expect(incident.sla).toBeNull();
    });

    it('records the classification without taking it as an answer', async () => {
      await service.updateIncident(10, { n1: true }, admin);

      const data = writeOf(prisma.incident.update);
      expect(data).toMatchObject({ n1ClassifiedAt: brt('2026-10-15T11:00') });
      expect(data).not.toHaveProperty('firstRespondedAt');
    });

    it('can be undone, bringing the deadline back', async () => {
      stored({ n1ClassifiedAt: brt('2026-10-15T10:10') });

      await service.updateIncident(10, { n1: false }, admin);

      expect(writeOf(prisma.incident.update)).toMatchObject({
        n1ClassifiedAt: null,
      });
    });

    it('does not write anything when the classification stays the same', async () => {
      stored({ n1ClassifiedAt: brt('2026-10-15T10:10') });

      await service.updateIncident(10, { n1: true }, admin);

      expect(writeOf(prisma.incident.update)).not.toHaveProperty(
        'n1ClassifiedAt',
      );
    });
  });

  describe('showing the SLA', () => {
    it('adds it to the incident detail', async () => {
      const incident = await service.getIncident(10, client);

      expect(incident.sla).toEqual({
        cycle: 'OPENING',
        startedAt: brt('2026-10-15T10:00'),
        state: 'ON_TIME',
        priority: IncidentLevel.ERROR,
        target: 'até 4h úteis',
        dueAt: brt('2026-10-15T14:00'),
        respondedAt: null,
        remainingMinutes: 180,
        overdueMinutes: null,
        responseMinutes: null,
      });
    });

    it('adds it to each listed incident and counts the late ones of the filtered set', async () => {
      // Crítico (2h) aberto às 17h de quarta: venceu às 10h de quinta. Alta
      // aberto às 16h30 de quarta: vence às 11h30, com 30 min das 4h sobrando.
      const awaiting = [
        incidentRow({
          priority: IncidentLevel.CRITICAL,
          createdAt: brt('2026-10-14T17:00'),
        }),
        incidentRow({ createdAt: brt('2026-10-14T16:30') }),
        incidentRow(),
      ];
      prisma.incident.findMany.mockImplementation((args: FindManyArg) =>
        Promise.resolve(args.select ? awaiting : [incidentRow()]),
      );

      const page = await service.getIncidents(
        { status: IncidentStatus.OPEN },
        client,
      );

      expect(page.items[0].sla).toMatchObject({
        state: 'ON_TIME',
        remainingMinutes: 180,
      });
      expect(page.summary.sla).toEqual({ breached: 1, atRisk: 1 });

      const slaQuery = (prisma.incident.findMany.mock.calls as [FindManyArg][])
        .map(([args]) => args)
        .find((args) => args.select);
      expect(slaQuery?.where).toEqual({
        AND: [
          { deletedAt: null, status: 'OPEN', companyId: 7 },
          {
            status: { not: IncidentStatus.RESOLVED },
            n1ClassifiedAt: null,
            OR: [
              { reopenedAt: null, firstRespondedAt: null },
              { reopenedAt: { not: null }, reopenRespondedAt: null },
            ],
          },
        ],
      });
    });
  });

  describe('monthly report', () => {
    it('reports the share answered on time, leaving out what has no result yet', async () => {
      // Aberto às 14h de quarta: Alta (4h) vence às 18h, Crítico às 16h.
      const opened = brt('2026-10-14T14:00');
      prisma.incident.findMany.mockResolvedValue([
        // No prazo: respondido às 15h.
        incidentRow({
          createdAt: opened,
          firstRespondedAt: brt('2026-10-14T15:00'),
        }),
        // Fora do prazo: respondido às 10h de quinta.
        incidentRow({
          createdAt: opened,
          firstRespondedAt: brt('2026-10-15T10:00'),
        }),
        // Crítico sem resposta, vencido.
        incidentRow({ createdAt: opened, priority: IncidentLevel.CRITICAL }),
        // Sem resultado ainda: no prazo e sem resposta.
        incidentRow({ createdAt: brt('2026-10-15T10:30') }),
        // Aberto pela equipe: nasce respondido e não conta.
        incidentRow({ createdAt: opened, firstRespondedAt: opened }),
      ]);

      const report = await service.getMonthlyReport(
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-31T00:00:00.000Z',
        },
        admin,
      );

      expect(report.entries.map((entry) => entry.slaState)).toEqual([
        'MET',
        'MISSED',
        'BREACHED',
        'ON_TIME',
        'MET',
      ]);
      expect(report.technicalIndicators[0]).toEqual({
        label: 'Primeira resposta no prazo',
        value: '33%',
        status: 'ATTENDED',
      });
    });

    it('shows a dash when no incident of the period has a result', async () => {
      const report = await service.getMonthlyReport(
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-31T00:00:00.000Z',
        },
        admin,
      );

      expect(report.technicalIndicators[0].value).toBe('-');
    });

    it('leaves N1 incidents out of the rate and counts them apart', async () => {
      const opened = brt('2026-10-14T14:00');
      prisma.incident.findMany.mockResolvedValue([
        incidentRow({
          createdAt: opened,
          firstRespondedAt: brt('2026-10-14T15:00'),
        }),
        // Respondido fora do prazo, mas N1: não pesa contra a equipe.
        incidentRow({
          createdAt: opened,
          firstRespondedAt: brt('2026-10-15T10:00'),
          n1ClassifiedAt: brt('2026-10-15T10:00'),
        }),
      ]);

      const report = await service.getMonthlyReport(
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-31T00:00:00.000Z',
        },
        admin,
      );

      expect(
        report.entries.map(({ slaState, n1 }) => ({ slaState, n1 })),
      ).toEqual([
        { slaState: 'MET', n1: false },
        { slaState: null, n1: true },
      ]);
      expect(report.technicalIndicators[0].value).toBe('100%');
      expect(report.technicalIndicators).toContainEqual({
        label: 'Chamados N1 (fora do SLA)',
        value: '1',
        status: 'ATTENDED',
      });
    });

    it('keeps the first response of a reopened incident in the report', async () => {
      const opened = brt('2026-10-14T14:00');
      prisma.incident.findMany.mockResolvedValue([
        incidentRow({
          createdAt: opened,
          firstRespondedAt: brt('2026-10-14T15:00'),
          reopenedAt: brt('2026-10-15T10:00'),
        }),
      ]);

      const report = await service.getMonthlyReport(
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-31T00:00:00.000Z',
        },
        admin,
      );

      expect(report.entries[0].slaState).toBe('MET');
    });
  });
});
