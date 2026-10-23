import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IncidentLevel, IncidentStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.types';
import { IncidentsService } from './incidents.service';

// O que o SLA lê do chamado; o banco sempre devolve.
const slaFields = {
  createdAt: new Date('2026-10-05T12:00:00Z'),
  priority: IncidentLevel.ERROR,
  status: IncidentStatus.OPEN,
  firstRespondedAt: null,
  responsePriority: null,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const png = (originalname: string) => ({
  buffer: PNG,
  originalname,
  mimetype: 'image/png',
  size: PNG.length,
});

describe('IncidentsService access rules', () => {
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
  const coworker: JwtPayload = {
    sub: 3,
    email: 'colega@example.com',
    role: UserRole.CLIENT,
    companyId: 7,
  };

  let prisma: {
    incident: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    company: { findUnique: jest.Mock };
  };
  let storage: { uploadObject: jest.Mock };
  let service: IncidentsService;

  beforeEach(() => {
    prisma = {
      incident: {
        create: jest.fn().mockResolvedValue({
          id: 10,
          ...slaFields,
          attachments: [],
          logs: [],
          events: [],
          comments: [],
          company: {},
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      company: {
        findUnique: jest.fn(({ where }: { where: { id: number } }) =>
          Promise.resolve({ id: where.id }),
        ),
      },
    };
    storage = {
      uploadObject: jest.fn(({ key }: { key: string }) =>
        Promise.resolve({ key }),
      ),
    };
    service = new IncidentsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
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

  const incidentOf = (companyId: number) => ({
    id: 5,
    companyId,
    ...slaFields,
    attachments: [],
    logs: [],
    events: [],
    comments: [],
    company: {},
  });

  describe('getSlaRules', () => {
    it('traz exemplos concretos em todas as criticidades', () => {
      const rules = service.getSlaRules();

      expect(rules.map((rule) => rule.priority)).toEqual([
        IncidentLevel.CRITICAL,
        IncidentLevel.ERROR,
        IncidentLevel.WARNING,
        IncidentLevel.INFO,
      ]);
      for (const rule of rules) {
        expect(rule.examples.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('createIncident', () => {
    const body = {
      title: 'Erro na emissão',
      description: 'Nota rejeitada',
      environment: 'production',
      priority: IncidentLevel.ERROR,
    };
    const evidence = [png('tela.png')];

    it('rejects a CLIENT that tries to set the status', async () => {
      await expect(
        service.createIncident(
          { ...body, status: IncidentStatus.RESOLVED },
          [],
          client,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it("opens a CLIENT's ticket as OPEN, in the user's company, recording who opened it", async () => {
      await service.createIncident(body, evidence, client);

      expect(createdData()).toMatchObject({
        status: IncidentStatus.OPEN,
        companyId: 7,
        createdById: 2,
      });
    });

    it('ignores a companyId sent by a CLIENT', async () => {
      await service.createIncident(
        { ...body, companyId: 99 },
        evidence,
        client,
      );

      expect(createdData().companyId).toBe(7);
      expect(prisma.company.findUnique).not.toHaveBeenCalled();
    });

    it('lets an ADMIN set the status and the company', async () => {
      await service.createIncident(
        { ...body, companyId: 99, status: IncidentStatus.IN_PROGRESS },
        [],
        admin,
      );

      expect(createdData()).toMatchObject({
        status: IncidentStatus.IN_PROGRESS,
        companyId: 99,
        createdById: 1,
      });
    });

    it('requires an ADMIN to choose the company', async () => {
      await expect(service.createIncident(body, [], admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('answers 400 when the ADMIN picks a company that does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createIncident({ ...body, companyId: 99 }, [], admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('refuses a CLIENT token without a company', async () => {
      await expect(
        service.createIncident(body, evidence, { ...client, companyId: null }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('requires a CLIENT to choose the priority', async () => {
      await expect(
        service.createIncident(
          { ...body, priority: undefined },
          evidence,
          client,
        ),
      ).rejects.toThrow('Informe a criticidade do chamado');
      expect(storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('requires a CLIENT to send at least one print', async () => {
      await expect(service.createIncident(body, [], client)).rejects.toThrow(
        'Anexe ao menos um print do problema',
      );
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('lets an ADMIN open without a print or a priority', async () => {
      await service.createIncident(
        {
          companyId: 99,
          title: body.title,
          description: body.description,
          environment: body.environment,
        },
        [],
        admin,
      );

      expect(createdData()).toMatchObject({
        companyId: 99,
        priority: IncidentLevel.ERROR,
      });
    });
  });

  describe('data scoping', () => {
    it("lets a CLIENT read any incident of the user's company", async () => {
      prisma.incident.findUnique.mockResolvedValue(incidentOf(7));

      await expect(service.getIncident(5, coworker)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('hides an incident that belongs to another company', async () => {
      prisma.incident.findUnique.mockResolvedValue(incidentOf(99));

      await expect(service.getIncident(5, client)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets an ADMIN read any incident', async () => {
      prisma.incident.findUnique.mockResolvedValue(incidentOf(99));

      await expect(service.getIncident(5, admin)).resolves.toMatchObject({
        id: 5,
      });
    });

    it("scopes a CLIENT's list to the user's company, whoever opened it and from any source", async () => {
      await service.getIncidents({ companyId: 99 }, client);

      expect(listedWhere()).toEqual({ companyId: 7, deletedAt: null });
    });

    it('never turns a CLIENT token without a company into an empty filter', async () => {
      await expect(
        service.getIncidents({}, { ...client, companyId: null }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.incident.findMany).not.toHaveBeenCalled();
    });

    it('lets an ADMIN filter the list by any company, by id or name', async () => {
      await service.getIncidents({ companyId: 99, company: 'Alfa' }, admin);

      expect(listedWhere()).toEqual({
        companyId: 99,
        company: { name: { contains: 'Alfa' } },
        deletedAt: null,
      });
    });

    it('lists every company for an ADMIN without a filter', async () => {
      await service.getIncidents({}, admin);

      expect(listedWhere()).toEqual({ deletedAt: null });
    });
  });
});
