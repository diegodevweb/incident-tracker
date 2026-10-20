import { ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';

type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
  skip?: number;
  take?: number;
};

describe('CompaniesService', () => {
  const companyRow = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    name: 'Atacado Alfa',
    cnpj: '11222333000181',
    disabledAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    _count: { users: 2, incidents: 3 },
    ...overrides,
  });
  let prisma: {
    company: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: CompaniesService;

  const callArgs = (mock: jest.Mock, index = 0) =>
    (mock.mock.calls[index] as [Args])[0];
  const duplicateCnpj = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(() => {
    prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([companyRow()]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(companyRow()),
        create: jest.fn().mockResolvedValue(companyRow()),
        update: jest.fn().mockResolvedValue(companyRow()),
      },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn((writes: Promise<unknown>[]) =>
        Promise.all(writes),
      ),
    };
    service = new CompaniesService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('pages the companies with the user and open incident counts', async () => {
      const result = await service.list({ page: 2, pageSize: 10 });

      const args = callArgs(prisma.company.findMany);
      expect(args.where).toEqual({});
      expect(args).toMatchObject({ skip: 10, take: 10 });
      expect(args.select).toMatchObject({
        _count: {
          select: {
            users: { where: { role: UserRole.CLIENT } },
            incidents: {
              where: {
                status: { not: IncidentStatus.RESOLVED },
                deletedAt: null,
              },
            },
          },
        },
      });
      expect(result).toEqual({
        items: [
          {
            id: 5,
            name: 'Atacado Alfa',
            cnpj: '11222333000181',
            disabledAt: null,
            createdAt: new Date('2026-10-01T00:00:00Z'),
            userCount: 2,
            openIncidents: 3,
          },
        ],
        total: 1,
        page: 2,
        pageSize: 10,
      });
    });

    it('searches by name or by CNPJ typed with punctuation', async () => {
      await service.list({ q: '11.222.333' });

      expect(callArgs(prisma.company.findMany).where).toEqual({
        OR: [
          { name: { contains: '11.222.333' } },
          { cnpj: { contains: '11222333' } },
        ],
      });
      expect(callArgs(prisma.company.count).where).toEqual(
        callArgs(prisma.company.findMany).where,
      );
    });

    it.each([
      ['active', { disabledAt: null }],
      ['disabled', { disabledAt: { not: null } }],
    ] as const)('filters %s companies', async (status, where) => {
      await service.list({ status });

      expect(callArgs(prisma.company.findMany).where).toEqual(where);
    });
  });

  describe('create and update', () => {
    it('creates a company, without a CNPJ when none was given', async () => {
      await service.create({ name: 'Atacado Alfa' });

      expect(callArgs(prisma.company.create).data).toEqual({
        name: 'Atacado Alfa',
        cnpj: null,
      });
    });

    it('answers 409 for a CNPJ already in use', async () => {
      prisma.company.create.mockRejectedValue(duplicateCnpj());

      await expect(
        service.create({ name: 'Outra', cnpj: '11222333000181' }),
      ).rejects.toThrow(ConflictException);
    });

    it('changes only what was sent and removes the CNPJ on null', async () => {
      await service.update(5, { cnpj: null });

      expect(callArgs(prisma.company.update)).toMatchObject({
        where: { id: 5 },
        data: { name: undefined, cnpj: null },
      });
    });

    it('answers 409 when the new CNPJ is taken', async () => {
      prisma.company.update.mockRejectedValue(duplicateCnpj());

      await expect(
        service.update(5, { cnpj: '11222333000181' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('disable and enable', () => {
    it('disables the company and ends every session of its users, in one transaction', async () => {
      await service.disable(5);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(callArgs(prisma.company.update)).toMatchObject({
        where: { id: 5 },
        data: { disabledAt: expect.any(Date) as Date },
      });
      expect(callArgs(prisma.user.updateMany)).toEqual({
        where: { companyId: 5 },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    it('keeps the original date when the company is already disabled', async () => {
      prisma.company.findUnique.mockResolvedValue(
        companyRow({ disabledAt: new Date('2026-10-02T00:00:00Z') }),
      );

      await service.disable(5);

      expect(prisma.company.update).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('enables the company without touching its users', async () => {
      await service.enable(5);

      expect(callArgs(prisma.company.update).data).toEqual({
        disabledAt: null,
      });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.get(5)).rejects.toThrow(NotFoundException);
      await expect(service.update(5, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.disable(5)).rejects.toThrow(NotFoundException);
      await expect(service.enable(5)).rejects.toThrow(NotFoundException);
      expect(prisma.company.update).not.toHaveBeenCalled();
    });
  });
});
