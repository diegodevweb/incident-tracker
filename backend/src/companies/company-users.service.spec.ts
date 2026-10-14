import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { checkPasswordPolicy } from '../auth/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyUsersService } from './company-users.service';

type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

describe('CompanyUsersService', () => {
  const userRow = {
    id: 9,
    name: 'Ana',
    email: 'ana@empresa.com',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    disabledAt: null,
    mustChangePassword: false,
  };
  const storedUser = (overrides: Record<string, unknown> = {}) => ({
    id: 9,
    email: 'ana@empresa.com',
    role: UserRole.CLIENT,
    companyId: 5,
    disabledAt: null,
    ...overrides,
  });
  let prisma: {
    company: { findUnique: jest.Mock };
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: CompanyUsersService;

  const callArgs = (mock: jest.Mock) => (mock.mock.calls[0] as [Args])[0];
  const duplicateEmail = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 5 }) },
      user: {
        findMany: jest.fn().mockResolvedValue([userRow]),
        findUnique: jest.fn().mockResolvedValue(storedUser()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(userRow),
        create: jest.fn().mockResolvedValue(userRow),
        update: jest.fn().mockResolvedValue(userRow),
      },
    };
    service = new CompanyUsersService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it("lists only the company's client users, without secrets", async () => {
      await expect(service.list(5)).resolves.toEqual([userRow]);

      const args = callArgs(prisma.user.findMany);
      expect(args.where).toEqual({ companyId: 5, role: UserRole.CLIENT });
      expect(args.select).not.toHaveProperty('password');
      expect(args.select).not.toHaveProperty('tokenVersion');
    });

    it('answers 404 for an unknown company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.list(5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a client user of the company with a temporary password returned once', async () => {
      const result = await service.create(5, {
        name: 'Ana',
        email: 'ana@empresa.com',
      });

      const data = callArgs(prisma.user.create).data!;
      expect(data).toMatchObject({
        name: 'Ana',
        email: 'ana@empresa.com',
        role: UserRole.CLIENT,
        companyId: 5,
        mustChangePassword: true,
      });
      expect(
        checkPasswordPolicy(result.temporaryPassword, {
          email: 'ana@empresa.com',
        }),
      ).toEqual([]);
      await expect(
        bcrypt.compare(result.temporaryPassword, data.password as string),
      ).resolves.toBe(true);
      expect(result.user).toEqual(userRow);
    });

    it('answers 404 for an unknown company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.create(5, { name: 'Ana', email: 'ana@empresa.com' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('answers 409 for an e-mail already in use', async () => {
      prisma.user.create.mockRejectedValue(duplicateEmail());

      await expect(
        service.create(5, { name: 'Ana', email: 'ana@empresa.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changes to an existing user', () => {
    it('updates name and e-mail', async () => {
      await service.update(5, 9, { name: 'Nova', email: 'nova@example.com' });

      expect(callArgs(prisma.user.update)).toMatchObject({
        where: { id: 9 },
        data: { name: 'Nova', email: 'nova@example.com' },
      });
    });

    it('answers 409 when the new e-mail is taken', async () => {
      prisma.user.update.mockRejectedValue(duplicateEmail());

      await expect(
        service.update(5, 9, { email: 'outro@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('resets the password, logs the user out and requires a change', async () => {
      const { temporaryPassword } = await service.resetPassword(5, 9);

      const data = callArgs(prisma.user.update).data!;
      expect(data).toMatchObject({
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      });
      await expect(
        bcrypt.compare(temporaryPassword, data.password as string),
      ).resolves.toBe(true);
    });

    it('disables the user and logs it out', async () => {
      await service.disable(5, 9);

      expect(callArgs(prisma.user.update).data).toEqual({
        disabledAt: expect.any(Date) as Date,
        tokenVersion: { increment: 1 },
      });
    });

    it('keeps the original date when the user is already disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        storedUser({ disabledAt: new Date('2026-10-02T00:00:00Z') }),
      );

      await service.disable(5, 9);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('enables the user again', async () => {
      await service.enable(5, 9);

      expect(callArgs(prisma.user.update).data).toEqual({ disabledAt: null });
    });

    it.each([
      ['an unknown id', null],
      ['an admin', storedUser({ role: UserRole.ADMIN, companyId: null })],
      ['a user of another company', storedUser({ companyId: 6 })],
    ])('never touches %s', async (_, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.update(5, 9, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resetPassword(5, 9)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.disable(5, 9)).rejects.toThrow(NotFoundException);
      await expect(service.enable(5, 9)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
