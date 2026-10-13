import { ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { checkPasswordPolicy } from '../auth/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
  skip?: number;
  take?: number;
};

describe('ClientsService', () => {
  const clientRow = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    name: 'Empresa',
    email: 'empresa@example.com',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    disabledAt: null,
    mustChangePassword: false,
    _count: { incidents: 3 },
    ...overrides,
  });
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: ClientsService;

  const callArgs = (mock: jest.Mock) => (mock.mock.calls[0] as [Args])[0];
  const duplicateEmail = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([clientRow()]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          email: 'empresa@example.com',
          role: UserRole.CLIENT,
          disabledAt: null,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(clientRow()),
        create: jest.fn().mockResolvedValue(clientRow()),
        update: jest.fn().mockResolvedValue(clientRow()),
      },
    };
    service = new ClientsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('lists only clients, paginated, with the open incident count', async () => {
      const result = await service.list({ page: 2, pageSize: 10 });

      const args = callArgs(prisma.user.findMany);
      expect(args.where).toEqual({ role: UserRole.CLIENT });
      expect(args).toMatchObject({ skip: 10, take: 10 });
      expect(args.select).toMatchObject({
        _count: {
          select: {
            incidents: { where: { status: { not: IncidentStatus.RESOLVED } } },
          },
        },
      });
      expect(args.select).not.toHaveProperty('password');
      expect(args.select).not.toHaveProperty('tokenVersion');
      expect(result).toEqual({
        items: [
          {
            id: 5,
            name: 'Empresa',
            email: 'empresa@example.com',
            createdAt: new Date('2026-10-01T00:00:00Z'),
            disabledAt: null,
            mustChangePassword: false,
            openIncidents: 3,
          },
        ],
        total: 1,
        page: 2,
        pageSize: 10,
      });
    });

    it('searches by name or e-mail within clients', async () => {
      await service.list({ q: 'acme' });

      expect(callArgs(prisma.user.findMany).where).toEqual({
        role: UserRole.CLIENT,
        OR: [{ name: { contains: 'acme' } }, { email: { contains: 'acme' } }],
      });
      expect(callArgs(prisma.user.count).where).toEqual(
        callArgs(prisma.user.findMany).where,
      );
    });
  });

  describe('create', () => {
    it('creates a client with a temporary password returned once', async () => {
      const result = await service.create({
        name: 'Empresa',
        email: 'empresa@example.com',
      });

      const data = callArgs(prisma.user.create).data!;
      expect(data).toMatchObject({
        name: 'Empresa',
        email: 'empresa@example.com',
        role: UserRole.CLIENT,
        mustChangePassword: true,
      });
      expect(
        checkPasswordPolicy(result.temporaryPassword, {
          email: 'empresa@example.com',
        }),
      ).toEqual([]);
      await expect(
        bcrypt.compare(result.temporaryPassword, data.password as string),
      ).resolves.toBe(true);
      expect(result.client).toMatchObject({ id: 5, openIncidents: 3 });
      expect(result.client).not.toHaveProperty('password');
    });

    it('answers 409 for an e-mail already in use', async () => {
      prisma.user.create.mockRejectedValue(duplicateEmail());

      await expect(
        service.create({ name: 'Empresa', email: 'empresa@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changes to an existing client', () => {
    it('updates name and e-mail', async () => {
      await service.update(5, { name: 'Nova', email: 'nova@example.com' });

      expect(callArgs(prisma.user.update)).toMatchObject({
        where: { id: 5 },
        data: { name: 'Nova', email: 'nova@example.com' },
      });
    });

    it('answers 409 when the new e-mail is taken', async () => {
      prisma.user.update.mockRejectedValue(duplicateEmail());

      await expect(
        service.update(5, { email: 'outro@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('resets the password, logs the client out and requires a change', async () => {
      const { temporaryPassword } = await service.resetPassword(5);

      const data = callArgs(prisma.user.update).data!;
      expect(data).toMatchObject({
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      });
      await expect(
        bcrypt.compare(temporaryPassword, data.password as string),
      ).resolves.toBe(true);
    });

    it('disables the client and logs it out', async () => {
      await service.disable(5);

      expect(callArgs(prisma.user.update).data).toEqual({
        disabledAt: expect.any(Date) as Date,
        tokenVersion: { increment: 1 },
      });
    });

    it('keeps the original date when the client is already disabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        email: 'empresa@example.com',
        role: UserRole.CLIENT,
        disabledAt: new Date('2026-10-02T00:00:00Z'),
      });

      await service.disable(5);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('enables the client again', async () => {
      await service.enable(5);

      expect(callArgs(prisma.user.update).data).toEqual({ disabledAt: null });
    });

    it.each([
      ['an unknown id', null],
      [
        'an admin',
        {
          id: 1,
          email: 'a@example.com',
          role: UserRole.ADMIN,
          disabledAt: null,
        },
      ],
    ])('never touches %s', async (_, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.update(1, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resetPassword(1)).rejects.toThrow(NotFoundException);
      await expect(service.disable(1)).rejects.toThrow(NotFoundException);
      await expect(service.enable(1)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
