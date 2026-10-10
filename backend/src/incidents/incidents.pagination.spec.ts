import { BadRequestException } from '@nestjs/common';
import {
  AttachmentCategory,
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

const PUBLIC_CLIENT = { select: { id: true, name: true, email: true } };

type QueryArg = {
  where?: Record<string, unknown>;
  include: {
    client?: unknown;
    logs?: { take?: number };
    attachments?: unknown;
  };
  skip?: number;
  take?: number;
  orderBy?: unknown;
};
type Call = [QueryArg];

describe('IncidentsService pagination, report limits and client exposure', () => {
  let prisma: {
    incident: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    incidentLog: { findMany: jest.Mock };
    preventiveAction: { findMany: jest.Mock };
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
      incidentLog: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
      preventiveAction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    storage = {
      uploadObject: jest.fn(),
      deleteObject: jest.fn(),
      getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    };
    service = new IncidentsService(prisma as unknown as PrismaService, storage);
  });

  const firstCall = (mock: jest.Mock) => (mock.mock.calls as Call[])[0][0];

  describe('GET /incidents', () => {
    it('returns the first page of 20 by default', async () => {
      const result = await service.getIncidents({}, admin);

      expect(firstCall(prisma.incident.findMany)).toMatchObject({
        skip: 0,
        take: 20,
      });
      expect(result).toMatchObject({ page: 1, pageSize: 20, total: 0 });
    });

    it('skips the previous pages', async () => {
      await service.getIncidents({ page: 3, pageSize: 10 }, admin);

      expect(firstCall(prisma.incident.findMany)).toMatchObject({
        skip: 20,
        take: 10,
      });
    });

    it('orders by creation date with the id as a tie-breaker', async () => {
      await service.getIncidents({}, admin);

      expect(firstCall(prisma.incident.findMany).orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);
    });

    it('does not load logs or attachments and does not sign any URL', async () => {
      prisma.incident.findMany.mockResolvedValue([
        incidentRow({ attachments: [{ url: 'incidents/x.png' }] }),
      ]);

      await service.getIncidents({}, admin);

      const { include } = firstCall(prisma.incident.findMany);
      expect(include).not.toHaveProperty('logs');
      expect(include).not.toHaveProperty('attachments');
      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('counts and summarizes the whole filtered set, not just the page', async () => {
      prisma.incident.count.mockResolvedValue(57);
      prisma.incident.groupBy.mockImplementation(({ by }: { by: string[] }) =>
        Promise.resolve(
          by[0] === 'status'
            ? [
                { status: IncidentStatus.OPEN, _count: { _all: 40 } },
                { status: IncidentStatus.RESOLVED, _count: { _all: 17 } },
              ]
            : by[0] === 'priority'
              ? [{ priority: IncidentLevel.CRITICAL, _count: { _all: 5 } }]
              : [{ source: IncidentSource.WEBHOOK, _count: { _all: 30 } }],
        ),
      );

      const result = await service.getIncidents({ pageSize: 10 }, admin);

      expect(result.total).toBe(57);
      expect(result.summary.byStatus).toEqual({
        OPEN: 40,
        PENDING: 0,
        IN_PROGRESS: 0,
        RESOLVED: 17,
      });
      expect(result.summary.byPriority.CRITICAL).toBe(5);
      expect(result.summary.byPriority.INFO).toBe(0);
      expect(result.summary.bySource).toEqual({ WEBHOOK: 30, DASHBOARD: 0 });
    });

    it('applies the same filter and client scope to the list, the count and the summary', async () => {
      await service.getIncidents(
        { status: IncidentStatus.OPEN, clientId: 99 },
        client,
      );

      const listWhere = firstCall(prisma.incident.findMany).where;
      expect(listWhere).toMatchObject({ status: 'OPEN', clientId: client.sub });
      expect(firstCall(prisma.incident.count).where).toEqual(listWhere);
      (prisma.incident.groupBy.mock.calls as Call[]).forEach(([args]) => {
        expect(args.where).toEqual(listWhere);
      });
    });
  });

  describe('client data in responses', () => {
    const operations: [string, () => Promise<unknown>, () => jest.Mock][] = [
      [
        'list',
        () => service.getIncidents({}, admin),
        () => prisma.incident.findMany,
      ],
      [
        'detail',
        () => service.getIncident(10, admin),
        () => prisma.incident.findUnique,
      ],
      [
        'create',
        () =>
          service.createIncident(
            {
              clientId: 2,
              title: 't',
              description: 'd',
              environment: 'production',
            },
            [],
            admin,
          ),
        () => prisma.incident.create,
      ],
      [
        'update',
        () => service.updateIncident(10, {}, admin),
        () => prisma.incident.update,
      ],
      [
        'webhook',
        () =>
          service.createErrorLog({
            clientId: 2,
            title: 't',
            description: 'd',
            message: 'm',
            environment: 'production',
          }),
        () => prisma.incident.create,
      ],
      [
        'monthly report',
        () =>
          service.getMonthlyReport(
            {
              startDate: '2026-10-01T00:00:00.000Z',
              endDate: '2026-10-31T00:00:00.000Z',
            },
            admin,
          ),
        () => prisma.incident.findMany,
      ],
    ];

    it.each(operations)(
      'selects only id, name and email of the client in the %s (never the password hash)',
      async (_name, run, mock) => {
        await run();

        const calls = mock().mock.calls as Call[];
        const include = calls[calls.length - 1][0].include;
        expect(include.client).toEqual(PUBLIC_CLIENT);
      },
    );
  });

  describe('GET /incidents/reports/monthly', () => {
    const report = (startDate: string, endDate: string) =>
      service.getMonthlyReport({ startDate, endDate }, admin);

    it('rejects an end date before the start date', async () => {
      await expect(
        report('2026-10-31T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.incident.findMany).not.toHaveBeenCalled();
    });

    it('rejects a period longer than a year', async () => {
      await expect(
        report('2025-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      ).rejects.toThrow('não pode passar de 366 dias');

      expect(prisma.incident.findMany).not.toHaveBeenCalled();
    });

    it('accepts a full year', async () => {
      await expect(
        report('2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z'),
      ).resolves.toBeDefined();
    });

    it('loads only the latest log and the corrective attachments', async () => {
      await report('2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z');

      const { include } = firstCall(prisma.incident.findMany);
      expect(include.logs?.take).toBe(1);
      expect(include.attachments).toEqual({
        where: { category: AttachmentCategory.CORRECTIVE_ACTION },
      });
    });

    it('signs URLs only for incidents that have corrective actions', async () => {
      prisma.incident.findMany.mockResolvedValue([
        incidentRow({ id: 1, attachments: [] }),
        incidentRow({
          id: 2,
          correctiveActions: 'Reiniciado',
          attachments: [
            {
              id: 5,
              url: 'incidents/fix.png',
              category: AttachmentCategory.CORRECTIVE_ACTION,
            },
          ],
        }),
      ]);

      const result = await report(
        '2026-10-01T00:00:00.000Z',
        '2026-10-31T00:00:00.000Z',
      );

      expect(storage.getDownloadUrl).toHaveBeenCalledTimes(1);
      expect(storage.getDownloadUrl).toHaveBeenCalledWith('incidents/fix.png');
      expect(result.correctiveActions).toHaveLength(1);
    });
  });

  describe('GET /incidents/error-logs', () => {
    it('returns at most 100 logs by default', async () => {
      await service.getErrorLogs({});

      expect(firstCall(prisma.incidentLog.findMany)).toMatchObject({
        skip: 0,
        take: 100,
      });
    });

    it('honors page and page size', async () => {
      await service.getErrorLogs({ page: 2, pageSize: 50 });

      expect(firstCall(prisma.incidentLog.findMany)).toMatchObject({
        skip: 50,
        take: 50,
      });
    });
  });
});
