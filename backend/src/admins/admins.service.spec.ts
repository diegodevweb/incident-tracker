import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { checkPasswordPolicy } from '../auth/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminsService } from './admins.service';

type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

describe('AdminsService', () => {
  // Quem age é o admin 1; o admin gerenciado é o 7.
  const actorId = 1;
  const adminRow = {
    id: 7,
    name: 'Bia',
    email: 'bia@equipe.com',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    disabledAt: null,
    mustChangePassword: false,
  };
  const storedUser = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    email: 'bia@equipe.com',
    role: UserRole.ADMIN,
    disabledAt: null,
    ...overrides,
  });
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: AdminsService;

  const callArgs = (mock: jest.Mock) => (mock.mock.calls[0] as [Args])[0];
  const duplicateEmail = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([adminRow]),
        findUnique: jest.fn().mockResolvedValue(storedUser()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(adminRow),
        create: jest.fn().mockResolvedValue(adminRow),
        update: jest.fn().mockResolvedValue(adminRow),
      },
    };
    service = new AdminsService(prisma as unknown as PrismaService);
  });

  it('lists only admins, disabled ones included, without secrets', async () => {
    await expect(service.list()).resolves.toEqual([adminRow]);

    const args = callArgs(prisma.user.findMany);
    expect(args.where).toEqual({ role: UserRole.ADMIN });
    expect(args.select).not.toHaveProperty('password');
    expect(args.select).not.toHaveProperty('tokenVersion');
  });

  describe('create', () => {
    it('creates an admin without a company and with a temporary password returned once', async () => {
      const result = await service.create({
        name: 'Bia',
        email: 'bia@equipe.com',
      });

      const data = callArgs(prisma.user.create).data!;
      expect(data).toMatchObject({
        name: 'Bia',
        email: 'bia@equipe.com',
        role: UserRole.ADMIN,
        mustChangePassword: true,
      });
      expect(data).not.toHaveProperty('companyId');
      expect(
        checkPasswordPolicy(result.temporaryPassword, {
          email: 'bia@equipe.com',
        }),
      ).toEqual([]);
      await expect(
        bcrypt.compare(result.temporaryPassword, data.password as string),
      ).resolves.toBe(true);
      expect(result.user).toEqual(adminRow);
    });

    it('answers 409 for an e-mail already in use, by an admin or a client', async () => {
      prisma.user.create.mockRejectedValue(duplicateEmail());

      await expect(
        service.create({ name: 'Bia', email: 'bia@equipe.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changes to another admin', () => {
    it('updates name and e-mail', async () => {
      await service.update(actorId, 7, {
        name: 'Nova',
        email: 'nova@example.com',
      });

      expect(callArgs(prisma.user.update)).toMatchObject({
        where: { id: 7 },
        data: { name: 'Nova', email: 'nova@example.com' },
      });
    });

    it('answers 409 when the new e-mail is taken', async () => {
      prisma.user.update.mockRejectedValue(duplicateEmail());

      await expect(
        service.update(actorId, 7, { email: 'outro@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('resets the password, logs the admin out and requires a change', async () => {
      const { temporaryPassword } = await service.resetPassword(actorId, 7);

      const data = callArgs(prisma.user.update).data!;
      expect(data).toMatchObject({
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      });
      await expect(
        bcrypt.compare(temporaryPassword, data.password as string),
      ).resolves.toBe(true);
    });

    it('disables the admin and logs it out', async () => {
      await service.disable(actorId, 7);

      expect(callArgs(prisma.user.update).data).toEqual({
        disabledAt: expect.any(Date) as Date,
        tokenVersion: { increment: 1 },
      });
    });

    it('keeps the original date when the admin is already disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        storedUser({ disabledAt: new Date('2026-10-02T00:00:00Z') }),
      );

      await service.disable(actorId, 7);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('enables the admin again', async () => {
      await service.enable(actorId, 7);

      expect(callArgs(prisma.user.update).data).toEqual({ disabledAt: null });
    });

    it.each([
      ['an unknown id', null],
      ['a client user', storedUser({ role: UserRole.CLIENT })],
    ])('never touches %s', async (_, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.update(actorId, 7, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resetPassword(actorId, 7)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.disable(actorId, 7)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.enable(actorId, 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  it("refuses every change to the admin's own account", async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser({ id: actorId }));

    await expect(
      service.update(actorId, actorId, { email: 'eu@example.com' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.resetPassword(actorId, actorId)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.disable(actorId, actorId)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.enable(actorId, actorId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
