import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentCategory,
  IncidentEventType,
  IncidentLevel,
  IncidentSource,
  IncidentStatus,
  NotificationType,
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
const outsider: JwtPayload = {
  sub: 3,
  email: 'outra@example.com',
  role: UserRole.CLIENT,
  companyId: 99,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const png = (originalname: string) => ({
  buffer: PNG,
  originalname,
  mimetype: 'image/png',
  size: PNG.length,
});

type WriteArg = { data: Record<string, unknown> };

describe('IncidentsService client actions', () => {
  let prisma: {
    incident: { findUnique: jest.Mock; update: jest.Mock };
    incidentComment: { count: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let storage: {
    uploadObject: jest.Mock;
    deleteObject: jest.Mock;
    getDownloadUrl: jest.Mock;
  };
  let service: IncidentsService;

  const incidentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    companyId: 7,
    title: 'Erro',
    description: 'Descrição',
    correctiveActions: null,
    status: IncidentStatus.OPEN,
    priority: IncidentLevel.ERROR,
    source: IncidentSource.DASHBOARD,
    createdAt: new Date('2026-10-05T12:00:00Z'),
    updatedAt: new Date('2026-10-06T12:00:00Z'),
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

  const lastWrite = () => {
    const calls = prisma.incident.update.mock.calls as [WriteArg][];
    return calls[calls.length - 1][0];
  };

  beforeEach(() => {
    prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue(incidentRow()),
        update: jest.fn().mockResolvedValue(incidentRow()),
      },
      incidentComment: { count: jest.fn().mockResolvedValue(0) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
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

  describe('status changes by a client', () => {
    it.each([
      IncidentStatus.OPEN,
      IncidentStatus.PENDING,
      IncidentStatus.IN_PROGRESS,
    ])(
      'lets a client mark a %s incident as resolved, recording who did it',
      async (from) => {
        stored({ status: from });

        await service.updateIncident(
          10,
          { status: IncidentStatus.RESOLVED },
          client,
        );

        expect(lastWrite().data).toEqual({
          status: IncidentStatus.RESOLVED,
          events: {
            create: [
              {
                type: IncidentEventType.INCIDENT_RESOLVED,
                actorId: client.sub,
                metadata: {
                  fromStatus: from,
                  toStatus: IncidentStatus.RESOLVED,
                },
              },
            ],
          },
        });
      },
    );

    it('lets a client reopen a resolved incident, including one from the webhook', async () => {
      stored({
        status: IncidentStatus.RESOLVED,
        source: IncidentSource.WEBHOOK,
        createdBy: null,
      });

      await service.updateIncident(10, { status: IncidentStatus.OPEN }, client);

      // A reabertura começa um prazo novo, ainda sem resposta.
      expect(lastWrite().data).toEqual({
        status: IncidentStatus.OPEN,
        reopenedAt: expect.any(Date) as Date,
        reopenRespondedAt: null,
        reopenResponsePriority: null,
        events: {
          create: [
            {
              type: IncidentEventType.STATUS_CHANGED,
              actorId: client.sub,
              metadata: {
                fromStatus: IncidentStatus.RESOLVED,
                toStatus: IncidentStatus.OPEN,
              },
            },
          ],
        },
      });
    });

    it.each([
      [IncidentStatus.OPEN, IncidentStatus.PENDING],
      [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS],
      [IncidentStatus.IN_PROGRESS, IncidentStatus.OPEN],
      [IncidentStatus.PENDING, IncidentStatus.OPEN],
      [IncidentStatus.RESOLVED, IncidentStatus.IN_PROGRESS],
      [IncidentStatus.RESOLVED, IncidentStatus.PENDING],
    ])('keeps the move from %s to %s with the admin', async (from, to) => {
      stored({ status: from });

      await expect(
        service.updateIncident(10, { status: to }, client),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('accepts a client save that keeps the status as it is, without events', async () => {
      stored({ status: IncidentStatus.PENDING });

      await service.updateIncident(
        10,
        { status: IncidentStatus.PENDING },
        client,
      );

      expect(lastWrite().data).toEqual({ status: IncidentStatus.PENDING });
    });

    it.each([
      [
        'a corrective action text',
        { correctiveActions: 'Reiniciei o servidor' },
      ],
      ['an empty corrective action (removal)', { correctiveActions: '' }],
    ])('refuses %s from a client', async (_name, data) => {
      await expect(service.updateIncident(10, data, client)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('refuses corrective prints from a client before sending anything to storage', async () => {
      await expect(
        service.updateIncident(10, {}, client, [png('correcao.png')]),
      ).rejects.toThrow(ForbiddenException);

      expect(storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it("hides another company's incident from a client", async () => {
      await expect(
        service.updateIncident(
          10,
          { status: IncidentStatus.RESOLVED },
          outsider,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('still lets an admin move between any statuses', async () => {
      stored({ status: IncidentStatus.RESOLVED });

      await service.updateIncident(
        10,
        { status: IncidentStatus.IN_PROGRESS },
        admin,
      );

      expect(lastWrite().data).toMatchObject({
        status: IncidentStatus.IN_PROGRESS,
      });
    });
  });

  describe('evidence added after opening', () => {
    it('stores the images as general evidence and records who sent each one', async () => {
      await service.addAttachments(
        10,
        [png('tela.png'), png('log.png')],
        client,
      );

      const data = lastWrite().data as {
        attachments: { create: Record<string, unknown>[] };
        events: { create: unknown[] };
      };
      expect(data.attachments.create).toEqual([
        expect.objectContaining({
          filename: 'tela.png',
          mimeType: 'image/png',
          category: AttachmentCategory.GENERAL,
        }),
        expect.objectContaining({
          filename: 'log.png',
          category: AttachmentCategory.GENERAL,
        }),
      ]);
      expect(data.events.create).toEqual([
        {
          type: IncidentEventType.ATTACHMENT_ADDED,
          actorId: client.sub,
          metadata: {
            filename: 'tela.png',
            category: AttachmentCategory.GENERAL,
          },
        },
        {
          type: IncidentEventType.ATTACHMENT_ADDED,
          actorId: client.sub,
          metadata: {
            filename: 'log.png',
            category: AttachmentCategory.GENERAL,
          },
        },
      ]);
    });

    it('answers 400 when no image was sent', async () => {
      await expect(service.addAttachments(10, [], client)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.incident.findUnique).not.toHaveBeenCalled();
    });

    it("hides another company's incident and sends nothing to storage", async () => {
      await expect(
        service.addAttachments(10, [png('tela.png')], outsider),
      ).rejects.toThrow(NotFoundException);

      expect(storage.uploadObject).not.toHaveBeenCalled();
    });

    it('answers 404 for an incident that does not exist', async () => {
      prisma.incident.findUnique.mockResolvedValue(null);

      await expect(
        service.addAttachments(10, [png('tela.png')], admin),
      ).rejects.toThrow(NotFoundException);
      expect(storage.uploadObject).not.toHaveBeenCalled();
    });

    it('removes the uploaded images when saving them fails', async () => {
      prisma.incident.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.addAttachments(10, [png('tela.png')], client),
      ).rejects.toThrow('db down');

      const [{ key }] = storage.uploadObject.mock.calls[0] as [{ key: string }];
      expect(storage.deleteObject).toHaveBeenCalledWith(key);
    });
  });

  describe('priority', () => {
    it('lets an admin change the priority, recording the previous one', async () => {
      await service.updateIncident(
        10,
        { priority: IncidentLevel.CRITICAL },
        admin,
      );

      expect(lastWrite().data).toMatchObject({
        priority: IncidentLevel.CRITICAL,
        events: {
          create: [
            {
              type: IncidentEventType.PRIORITY_CHANGED,
              actorId: admin.sub,
              metadata: {
                fromPriority: IncidentLevel.ERROR,
                toPriority: IncidentLevel.CRITICAL,
              },
            },
          ],
        },
      });
    });

    it('does not let a client change the priority', async () => {
      await expect(
        service.updateIncident(
          10,
          { priority: IncidentLevel.CRITICAL },
          client,
        ),
      ).rejects.toThrow(
        'Apenas administradores mudam a criticidade do chamado',
      );

      expect(prisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('notices to the company', () => {
    const notifications = () =>
      (
        lastWrite().data.notifications as {
          createMany: { data: Record<string, unknown>[] };
        }
      ).createMany.data;

    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([{ id: 2 }, { id: 5 }]);
    });

    it("tells every active user of the incident's company about a status change by an admin", async () => {
      await service.updateIncident(
        10,
        { status: IncidentStatus.IN_PROGRESS },
        admin,
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { companyId: 7, role: UserRole.CLIENT, disabledAt: null },
        select: { id: true },
      });
      const metadata = {
        fromStatus: IncidentStatus.OPEN,
        toStatus: IncidentStatus.IN_PROGRESS,
      };
      expect(notifications()).toEqual([
        { userId: 2, type: NotificationType.STATUS_CHANGED, metadata },
        { userId: 5, type: NotificationType.STATUS_CHANGED, metadata },
      ]);
    });

    it('sends one notice per change kind when an admin changes several things', async () => {
      await service.updateIncident(
        10,
        {
          status: IncidentStatus.RESOLVED,
          priority: IncidentLevel.WARNING,
          correctiveActions: 'Fila reprocessada',
        },
        admin,
        [png('correcao.png')],
      );

      expect(
        notifications()
          .filter((notice) => notice.userId === 2)
          .map((notice) => notice.type),
      ).toEqual([
        NotificationType.STATUS_CHANGED,
        NotificationType.PRIORITY_CHANGED,
        NotificationType.CORRECTIVE_ACTION_UPDATED,
      ]);
    });

    it('does not tell anyone when an admin saves without changes', async () => {
      await service.updateIncident(
        10,
        { status: IncidentStatus.OPEN, priority: IncidentLevel.ERROR },
        admin,
      );

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(lastWrite().data).not.toHaveProperty('notifications');
    });

    it('does not tell anyone about what a client did', async () => {
      await service.updateIncident(
        10,
        { status: IncidentStatus.RESOLVED },
        client,
      );

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(lastWrite().data).not.toHaveProperty('notifications');
    });

    it('writes nothing when the company has no active user', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.updateIncident(
        10,
        { status: IncidentStatus.PENDING },
        admin,
      );

      expect(lastWrite().data).not.toHaveProperty('notifications');
    });

    it('tells the company when an admin writes in the conversation', async () => {
      await service.addComment(10, { message: 'Estamos verificando' }, admin);

      expect(notifications()).toEqual([
        { userId: 2, type: NotificationType.COMMENT_ADDED },
        { userId: 5, type: NotificationType.COMMENT_ADDED },
      ]);
    });

    it('does not tell the company about a client reply', async () => {
      prisma.incidentComment.count.mockResolvedValue(1);

      await service.addComment(10, { message: 'Voltou a acontecer' }, client);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(lastWrite().data).not.toHaveProperty('notifications');
    });
  });

  describe('conversation', () => {
    it('lets an admin write at any time', async () => {
      await service.addComment(10, { message: 'Estamos verificando' }, admin);

      expect(prisma.incidentComment.count).not.toHaveBeenCalled();
      expect(lastWrite().data).toEqual({
        comments: {
          create: { authorId: admin.sub, message: 'Estamos verificando' },
        },
        // A primeira mensagem da equipe é a primeira resposta do SLA.
        firstRespondedAt: expect.any(Date) as Date,
        responsePriority: IncidentLevel.ERROR,
      });
    });

    it('does not let a client write before the first admin message', async () => {
      await expect(
        service.addComment(10, { message: 'Alguma novidade?' }, client),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.incidentComment.count).toHaveBeenCalledWith({
        where: { incidentId: 10, author: { role: UserRole.ADMIN } },
      });
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('lets a client reply once an admin has written', async () => {
      prisma.incidentComment.count.mockResolvedValue(1);

      await service.addComment(10, { message: 'Voltou a acontecer' }, client);

      expect(lastWrite().data).toEqual({
        comments: {
          create: { authorId: client.sub, message: 'Voltou a acontecer' },
        },
      });
    });

    it("hides another company's incident before looking at the conversation", async () => {
      prisma.incidentComment.count.mockResolvedValue(1);

      await expect(
        service.addComment(10, { message: 'Oi' }, outsider),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.incidentComment.count).not.toHaveBeenCalled();
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('shows each message with the name and side of its author, without the e-mail', async () => {
      stored({
        comments: [
          {
            id: 1,
            incidentId: 10,
            authorId: 1,
            message: 'Estamos verificando',
            createdAt: new Date('2026-10-06T12:00:00Z'),
            author: { name: 'Suporte', role: UserRole.ADMIN },
          },
          {
            id: 2,
            incidentId: 10,
            authorId: 2,
            message: 'Obrigado',
            createdAt: new Date('2026-10-06T13:00:00Z'),
            author: { name: 'Cliente', role: UserRole.CLIENT },
          },
        ],
      });

      const incident = await service.getIncident(10, client);

      expect(incident.comments).toEqual([
        {
          id: 1,
          message: 'Estamos verificando',
          createdAt: new Date('2026-10-06T12:00:00Z'),
          authorName: 'Suporte',
          authorRole: UserRole.ADMIN,
        },
        {
          id: 2,
          message: 'Obrigado',
          createdAt: new Date('2026-10-06T13:00:00Z'),
          authorName: 'Cliente',
          authorRole: UserRole.CLIENT,
        },
      ]);
    });

    it('loads the conversation in order with only the name and role of each author', async () => {
      await service.getIncident(10, client);

      const [{ include }] = prisma.incident.findUnique.mock.calls[0] as [
        { include: { comments: unknown } },
      ];
      expect(include.comments).toEqual({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { author: { select: { name: true, role: true } } },
      });
    });
  });
});
