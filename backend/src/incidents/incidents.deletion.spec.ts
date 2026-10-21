import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
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
  companyId: null,
};
const client: JwtPayload = {
  sub: 2,
  email: 'cliente@example.com',
  role: UserRole.CLIENT,
  companyId: 7,
};
// Outro usuário da mesma empresa.
const colleague: JwtPayload = { ...client, sub: 4 };
const outsider: JwtPayload = {
  sub: 3,
  email: 'outra@example.com',
  role: UserRole.CLIENT,
  companyId: 99,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

type WriteArg = { data: Record<string, unknown> };
type FindManyArg = { where?: Record<string, unknown> };

const byAdmin = { actor: { name: 'Ana Suporte', role: UserRole.ADMIN } };
const byClient = { actor: { name: 'Cliente', role: UserRole.CLIENT } };

describe('IncidentsService deletion', () => {
  let prisma: {
    incident: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    incidentComment: { count: jest.Mock };
    user: { findMany: jest.Mock };
    preventiveAction: { findMany: jest.Mock; create: jest.Mock };
  };
  let service: IncidentsService;

  // Aberto pelo próprio cliente pelo painel, sem nada da equipe ainda.
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
    createdById: 2,
    createdAt: new Date('2026-10-05T12:00:00Z'),
    updatedAt: new Date('2026-10-05T12:00:00Z'),
    firstRespondedAt: null,
    responsePriority: null,
    reopenedAt: null,
    reopenRespondedAt: null,
    reopenResponsePriority: null,
    n1ClassifiedAt: null,
    deletedAt: null,
    deletedById: null,
    deletionReason: null,
    company: { id: 7, name: 'Alfa' },
    createdBy: { id: 2, name: 'Cliente' },
    deletedBy: null,
    attachments: [],
    logs: [],
    events: [{ id: 1, type: IncidentEventType.INCIDENT_CREATED, ...byClient }],
    comments: [],
    ...overrides,
  });

  const deletedRow = (overrides: Record<string, unknown> = {}) =>
    incidentRow({
      deletedAt: new Date('2026-10-06T12:00:00Z'),
      deletedById: 1,
      deletionReason: 'Aberto em duplicidade',
      deletedBy: { id: 1, name: 'Ana Suporte' },
      ...overrides,
    });

  const stored = (row: Record<string, unknown>) =>
    prisma.incident.findUnique.mockResolvedValue(row);

  const lastWrite = () => {
    const calls = prisma.incident.update.mock.calls as [WriteArg][];
    return calls[calls.length - 1][0].data;
  };

  beforeEach(() => {
    prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue(incidentRow()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(incidentRow()),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      incidentComment: { count: jest.fn().mockResolvedValue(1) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      preventiveAction: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
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

  describe('deleting', () => {
    it('lets an admin delete any incident, recording who, when and why', async () => {
      stored(
        incidentRow({
          createdById: null,
          source: IncidentSource.WEBHOOK,
          comments: [{ author: { role: UserRole.ADMIN } }],
        }),
      );

      await service.deleteIncident(
        10,
        { reason: 'Teste da integração' },
        admin,
      );

      expect(lastWrite()).toEqual({
        deletedAt: expect.any(Date) as Date,
        deletedById: admin.sub,
        deletionReason: 'Teste da integração',
        events: {
          create: {
            type: IncidentEventType.INCIDENT_DELETED,
            actorId: admin.sub,
            metadata: { reason: 'Teste da integração' },
          },
        },
      });
    });

    it('lets a client delete an incident they opened that the team has not touched', async () => {
      await service.deleteIncident(10, { reason: 'Abri errado' }, client);

      expect(lastWrite()).toMatchObject({
        deletedById: client.sub,
        deletionReason: 'Abri errado',
      });
    });

    it.each([
      ['opened by a colleague', incidentRow(), colleague],
      [
        'that came from the webhook',
        incidentRow({ createdById: null, source: IncidentSource.WEBHOOK }),
        client,
      ],
      [
        'with a message from the team',
        incidentRow({ comments: [{ author: { role: UserRole.ADMIN } }] }),
        client,
      ],
      [
        'with any change by the team',
        incidentRow({
          events: [
            { type: IncidentEventType.INCIDENT_CREATED, ...byClient },
            { type: IncidentEventType.PRIORITY_CHANGED, ...byAdmin },
          ],
        }),
        client,
      ],
    ])(
      'does not let a client delete an incident %s',
      async (_case, row, user) => {
        stored(row);

        await expect(
          service.deleteIncident(10, { reason: 'Não quero mais' }, user),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.incident.update).not.toHaveBeenCalled();
      },
    );

    it('hides incidents of another company', async () => {
      await expect(
        service.deleteIncident(10, { reason: 'Duplicado' }, outsider),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses an incident that is already deleted', async () => {
      stored(deletedRow());

      await expect(
        service.deleteIncident(10, { reason: 'De novo' }, admin),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.deleteIncident(10, { reason: 'De novo' }, client),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an incident that does not exist', async () => {
      stored(null as unknown as Record<string, unknown>);

      await expect(
        service.deleteIncident(10, { reason: 'Duplicado' }, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoring', () => {
    it('brings the incident back and records it', async () => {
      stored(deletedRow());

      await service.restoreIncident(10, admin);

      expect(lastWrite()).toEqual({
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        events: {
          create: {
            type: IncidentEventType.INCIDENT_RESTORED,
            actorId: admin.sub,
          },
        },
      });
    });

    it('refuses an incident that is not deleted', async () => {
      await expect(service.restoreIncident(10, admin)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('a deleted incident', () => {
    beforeEach(() => {
      stored(deletedRow());
    });

    it('no longer exists for the client', async () => {
      await expect(service.getIncident(10, client)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('can still be opened by an admin, who sees who deleted it and why', async () => {
      const incident = await service.getIncident(10, admin);

      expect(incident).toMatchObject({
        deletionReason: 'Aberto em duplicidade',
        deletedBy: { id: 1, name: 'Ana Suporte' },
        canDelete: false,
      });
    });

    it.each([
      [
        'an edit',
        (user: JwtPayload) =>
          service.updateIncident(10, { status: IncidentStatus.PENDING }, user),
      ],
      [
        'a message',
        (user: JwtPayload) => service.addComment(10, { message: 'Olá' }, user),
      ],
      [
        'evidence',
        (user: JwtPayload) =>
          service.addAttachments(
            10,
            [
              {
                buffer: PNG,
                originalname: 'p.png',
                mimetype: 'image/png',
                size: PNG.length,
              },
            ],
            user,
          ),
      ],
    ])('takes no %s until restored', async (_case, act) => {
      await expect(act(admin)).rejects.toThrow(ConflictException);
      await expect(act(client)).rejects.toThrow(NotFoundException);
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('takes no preventive action', async () => {
      await expect(
        service.createPreventiveAction(
          { description: 'Revisar', incidentId: 10 },
          admin,
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.preventiveAction.create).not.toHaveBeenCalled();
    });
  });

  describe('who may delete, as the detail tells the page', () => {
    it.each([
      ['an admin', incidentRow(), admin, true],
      ['the client who opened it', incidentRow(), client, true],
      ['a colleague of that client', incidentRow(), colleague, false],
      [
        'the client, once the team answered',
        incidentRow({ comments: [{ author: { role: UserRole.ADMIN } }] }),
        client,
        false,
      ],
    ])('says %s', async (_case, row, user, canDelete) => {
      stored(row);

      const incident = await service.getIncident(10, user);

      expect(incident.canDelete).toBe(canDelete);
    });
  });

  describe('lists and report', () => {
    const lastListWhere = () => {
      const calls = prisma.incident.findMany.mock.calls as [FindManyArg][];
      return calls[0][0].where;
    };

    it('leaves deleted incidents out of the list', async () => {
      await service.getIncidents({}, admin);

      expect(lastListWhere()).toEqual({ deletedAt: null });
    });

    it('shows only the deleted ones in the trash of an admin', async () => {
      await service.getIncidents({ deleted: true }, admin);

      expect(lastListWhere()).toEqual({ deletedAt: { not: null } });
    });

    it('keeps the trash from clients', async () => {
      await expect(
        service.getIncidents({ deleted: true }, client),
      ).rejects.toThrow(ForbiddenException);
    });

    it('filters N1 incidents in or out', async () => {
      await service.getIncidents({ n1: true }, admin);
      expect(lastListWhere()).toMatchObject({ n1ClassifiedAt: { not: null } });

      prisma.incident.findMany.mockClear();
      await service.getIncidents({ n1: false }, admin);
      expect(lastListWhere()).toMatchObject({ n1ClassifiedAt: null });
    });

    it('leaves deleted incidents and their preventive actions out of the report', async () => {
      await service.getMonthlyReport(
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-31T00:00:00.000Z',
        },
        admin,
      );

      expect(lastListWhere()).toMatchObject({ deletedAt: null });
      const [[preventive]] = prisma.preventiveAction.findMany.mock.calls as [
        FindManyArg,
      ][];
      expect(preventive.where).toMatchObject({
        OR: [{ incidentId: null }, { incident: { deletedAt: null } }],
      });
    });
  });
});
