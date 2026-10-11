import {
  AttachmentCategory,
  IncidentEventType,
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
};
const client: JwtPayload = {
  sub: 2,
  email: 'cliente@example.com',
  role: UserRole.CLIENT,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const png = (originalname: string) => ({
  buffer: PNG,
  originalname,
  mimetype: 'image/png',
  size: PNG.length,
});

type WriteArg = {
  data: { events?: { create: unknown } };
  include?: { events?: unknown };
};
type ReadArg = { include: { events?: unknown } };

describe('IncidentsService audit events', () => {
  let prisma: {
    incident: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let storage: {
    uploadObject: jest.Mock;
    deleteObject: jest.Mock;
    getDownloadUrl: jest.Mock;
  };
  let service: IncidentsService;

  const incidentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    clientId: 2,
    title: 'Erro',
    description: 'Descrição',
    correctiveActions: null,
    status: IncidentStatus.OPEN,
    priority: IncidentLevel.ERROR,
    source: IncidentSource.DASHBOARD,
    createdAt: new Date('2026-10-05T12:00:00Z'),
    updatedAt: new Date('2026-10-06T12:00:00Z'),
    client: { id: 2, name: 'Cliente', email: 'cliente@example.com' },
    attachments: [],
    logs: [],
    events: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(incidentRow()),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(incidentRow()),
        update: jest.fn().mockResolvedValue(incidentRow()),
      },
    };
    storage = {
      uploadObject: jest.fn(({ key }: { key: string }) =>
        Promise.resolve({ key }),
      ),
      deleteObject: jest.fn(),
      getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    };
    service = new IncidentsService(prisma as unknown as PrismaService, storage);
  });

  const lastWrite = (mock: jest.Mock) => {
    const calls = mock.mock.calls as [WriteArg][];
    return calls[calls.length - 1][0];
  };

  describe('creating from the dashboard', () => {
    const body = {
      clientId: 2,
      title: 'Erro na emissão',
      description: 'Nota rejeitada',
      environment: 'production',
    };

    it('records who created it, in the same write as the incident', async () => {
      await service.createIncident(body, [], client);

      expect(lastWrite(prisma.incident.create).data.events).toEqual({
        create: [
          {
            type: IncidentEventType.INCIDENT_CREATED,
            actorId: client.sub,
            metadata: { status: IncidentStatus.OPEN },
          },
        ],
      });
    });

    it('records the initial status chosen by an ADMIN', async () => {
      await service.createIncident(
        { ...body, status: IncidentStatus.IN_PROGRESS },
        [],
        admin,
      );

      const { create } = lastWrite(prisma.incident.create).data.events as {
        create: { actorId: number; metadata: unknown }[];
      };
      expect(create[0]).toMatchObject({
        actorId: admin.sub,
        metadata: { status: IncidentStatus.IN_PROGRESS },
      });
    });

    it('records each attachment sent with the ticket', async () => {
      await service.createIncident(body, [png('tela.png')], client);

      const { create } = lastWrite(prisma.incident.create).data.events as {
        create: unknown[];
      };
      expect(create[1]).toEqual({
        type: IncidentEventType.ATTACHMENT_ADDED,
        actorId: client.sub,
        metadata: {
          filename: 'tela.png',
          category: AttachmentCategory.GENERAL,
        },
      });
    });
  });

  it('records webhook incidents without an author, with the key used', async () => {
    await service.createErrorLog(
      {
        title: 'Timeout',
        description: 'SEFAZ fora',
        message: 'ETIMEDOUT',
        environment: 'production',
      },
      { id: 7, clientId: 2 },
    );

    expect(lastWrite(prisma.incident.create).data.events).toEqual({
      create: {
        type: IncidentEventType.INCIDENT_CREATED,
        actorId: null,
        metadata: { status: IncidentStatus.OPEN, webhookKeyId: 7 },
      },
    });
  });

  describe('updating', () => {
    it('compares with the stored incident and records who changed it', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incidentRow({
          status: IncidentStatus.IN_PROGRESS,
          correctiveActions: 'Primeira versão',
        }),
      );

      await service.updateIncident(
        10,
        {
          status: IncidentStatus.RESOLVED,
          correctiveActions: 'Segunda versão',
        },
        admin,
        [png('depois.png')],
      );

      expect(lastWrite(prisma.incident.update).data.events).toEqual({
        create: [
          {
            type: IncidentEventType.INCIDENT_RESOLVED,
            actorId: admin.sub,
            metadata: {
              fromStatus: IncidentStatus.IN_PROGRESS,
              toStatus: IncidentStatus.RESOLVED,
            },
          },
          {
            type: IncidentEventType.CORRECTIVE_ACTION_ADDED,
            actorId: admin.sub,
            metadata: {
              description: 'Segunda versão',
              previousDescription: 'Primeira versão',
            },
          },
          {
            type: IncidentEventType.ATTACHMENT_ADDED,
            actorId: admin.sub,
            metadata: {
              filename: 'depois.png',
              category: AttachmentCategory.CORRECTIVE_ACTION,
            },
          },
        ],
      });
    });

    it('treats an empty corrective action as removing it', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incidentRow({ correctiveActions: 'Texto antigo' }),
      );

      await service.updateIncident(10, { correctiveActions: '' }, admin);

      const write = lastWrite(prisma.incident.update);
      expect(write.data).toMatchObject({
        correctiveActions: null,
        events: {
          create: [
            {
              type: IncidentEventType.CORRECTIVE_ACTION_REMOVED,
              actorId: admin.sub,
              metadata: { previousDescription: 'Texto antigo' },
            },
          ],
        },
      });
    });

    it('writes no event when the save changes nothing', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incidentRow({ correctiveActions: 'Igual' }),
      );

      await service.updateIncident(
        10,
        { status: IncidentStatus.OPEN, correctiveActions: 'Igual' },
        admin,
      );

      expect(lastWrite(prisma.incident.update).data).not.toHaveProperty(
        'events',
      );
    });
  });

  describe('reading', () => {
    const storedEvents = [
      {
        id: 1,
        incidentId: 10,
        type: IncidentEventType.INCIDENT_CREATED,
        actorId: 2,
        metadata: { status: 'OPEN' },
        createdAt: new Date('2026-10-05T12:00:00Z'),
        actor: { name: 'Cliente' },
      },
      {
        id: 2,
        incidentId: 10,
        type: IncidentEventType.STATUS_CHANGED,
        actorId: 1,
        metadata: { fromStatus: 'OPEN', toStatus: 'PENDING' },
        createdAt: new Date('2026-10-05T13:00:00Z'),
        actor: { name: 'Ana Suporte' },
      },
    ];

    it('loads the events oldest first and only the author name', async () => {
      await service.getIncident(10, client);

      const [[{ include }]] = prisma.incident.findUnique.mock.calls as [
        [ReadArg],
      ];
      expect(include.events).toEqual({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { actor: { select: { name: true } } },
      });
    });

    it('returns the events in the detail with the author name', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incidentRow({ events: storedEvents }),
      );

      const incident = await service.getIncident(10, client);

      expect(incident.events).toEqual([
        {
          id: 1,
          type: IncidentEventType.INCIDENT_CREATED,
          createdAt: storedEvents[0].createdAt,
          actorName: 'Cliente',
          metadata: { status: 'OPEN' },
        },
        {
          id: 2,
          type: IncidentEventType.STATUS_CHANGED,
          createdAt: storedEvents[1].createdAt,
          actorName: 'Ana Suporte',
          metadata: { fromStatus: 'OPEN', toStatus: 'PENDING' },
        },
      ]);
    });

    it('returns the events after creating and updating', async () => {
      prisma.incident.create.mockResolvedValue(
        incidentRow({ events: storedEvents.slice(0, 1) }),
      );
      prisma.incident.update.mockResolvedValue(
        incidentRow({ events: storedEvents }),
      );

      const created = await service.createIncident(
        {
          clientId: 2,
          title: 't',
          description: 'd',
          environment: 'production',
        },
        [],
        client,
      );
      const updated = await service.updateIncident(
        10,
        { status: IncidentStatus.PENDING },
        admin,
      );

      expect(created.data.events).toHaveLength(1);
      expect(updated.events.map((event) => event.actorName)).toEqual([
        'Cliente',
        'Ana Suporte',
      ]);
      expect(
        (prisma.incident.update.mock.calls as [WriteArg][])[0][0].include
          ?.events,
      ).toBeDefined();
    });

    it('does not load events in the list', async () => {
      await service.getIncidents({}, admin);

      const [[{ include }]] = prisma.incident.findMany.mock.calls as [
        [ReadArg],
      ];
      expect(include).not.toHaveProperty('events');
    });
  });
});
