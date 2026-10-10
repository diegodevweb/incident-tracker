import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IncidentStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.types';
import { IncidentsService } from './incidents.service';

describe('IncidentsService access rules', () => {
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

  let prisma: {
    incident: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let service: IncidentsService;

  beforeEach(() => {
    prisma = {
      incident: {
        create: jest.fn().mockResolvedValue({
          id: 10,
          attachments: [],
          logs: [],
          client: {},
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    service = new IncidentsService(
      prisma as unknown as PrismaService,
      {} as StorageService,
    );
  });

  const createdData = () =>
    (
      prisma.incident.create.mock.calls as [[{ data: Record<string, unknown> }]]
    )[0][0].data;

  const listedWhere = () =>
    (
      prisma.incident.findMany.mock.calls as [
        [{ where: Record<string, unknown> }],
      ]
    )[0][0].where;

  describe('createIncident', () => {
    const body = {
      title: 'Erro na emissão',
      description: 'Nota rejeitada',
      environment: 'production',
    };

    it('rejects a CLIENT that tries to set the status', async () => {
      await expect(
        service.createIncident(
          { ...body, clientId: client.sub, status: IncidentStatus.RESOLVED },
          [],
          client,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('opens the ticket as OPEN for a CLIENT', async () => {
      await service.createIncident(
        { ...body, clientId: client.sub },
        [],
        client,
      );

      expect(createdData().status).toBe(IncidentStatus.OPEN);
    });

    it('ignores a clientId that belongs to somebody else when the user is a CLIENT', async () => {
      await service.createIncident({ ...body, clientId: 99 }, [], client);

      expect(createdData().clientId).toBe(client.sub);
    });

    it('lets an ADMIN set the status and the client', async () => {
      await service.createIncident(
        { ...body, clientId: 99, status: IncidentStatus.IN_PROGRESS },
        [],
        admin,
      );

      expect(createdData().status).toBe(IncidentStatus.IN_PROGRESS);
      expect(createdData().clientId).toBe(99);
    });
  });

  describe('data scoping', () => {
    it('hides an incident that belongs to another client', async () => {
      prisma.incident.findUnique.mockResolvedValue({
        id: 5,
        clientId: 99,
        attachments: [],
        logs: [],
        client: {},
      });

      await expect(service.getIncident(5, client)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets an ADMIN read any incident', async () => {
      prisma.incident.findUnique.mockResolvedValue({
        id: 5,
        clientId: 99,
        attachments: [],
        logs: [],
        client: {},
      });

      await expect(service.getIncident(5, admin)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('scopes the list to the CLIENT even when another clientId is requested', async () => {
      await service.getIncidents({ clientId: 99 }, client);

      expect(listedWhere().clientId).toBe(client.sub);
    });

    it('lets an ADMIN filter the list by any client', async () => {
      await service.getIncidents({ clientId: 99 }, admin);

      expect(listedWhere().clientId).toBe(99);
    });
  });
});
