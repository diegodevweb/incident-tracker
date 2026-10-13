import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/passwords';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  // Senhas montadas em tempo de execução: nada parecido com credencial no código.
  const strongPassword = () => randomBytes(18).toString('base64url');
  let currentPassword: string;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let authService: { issueSession: jest.Mock };
  let service: AccountService;

  const storedUser = async () => ({
    id: 2,
    name: 'Cliente',
    email: 'cliente@example.com',
    password: await hashPassword(currentPassword),
    role: UserRole.CLIENT,
    tokenVersion: 4,
    mustChangePassword: true,
    disabledAt: null,
  });
  const updateData = () =>
    (prisma.user.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;

  beforeEach(async () => {
    currentPassword = strongPassword();
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(await storedUser()),
        update: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 2, ...args.data }),
        ),
      },
    };
    authService = {
      issueSession: jest.fn().mockResolvedValue({ accessToken: 'new-token' }),
    };
    service = new AccountService(
      prisma as unknown as PrismaService,
      authService as unknown as AuthService,
    );
  });

  describe('changePassword', () => {
    it('stores the new hash, clears the temporary flag and revokes other sessions', async () => {
      const newPassword = strongPassword();

      await expect(
        service.changePassword(2, { currentPassword, newPassword }),
      ).resolves.toEqual({ accessToken: 'new-token' });

      const data = updateData();
      expect(data.mustChangePassword).toBe(false);
      expect(data.tokenVersion).toEqual({ increment: 1 });
      await expect(
        bcrypt.compare(newPassword, data.password as string),
      ).resolves.toBe(true);
      // O token novo sai do usuário já atualizado (versão nova).
      expect(authService.issueSession).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: false }),
      );
    });

    it('rejects a wrong current password with 400, not 401', async () => {
      await expect(
        service.changePassword(2, {
          currentPassword: strongPassword(),
          newPassword: strongPassword(),
        }),
      ).rejects.toThrow(new BadRequestException('Senha atual incorreta'));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      await expect(
        service.changePassword(2, {
          currentPassword,
          newPassword: currentPassword,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('applies the password policy with the account e-mail', async () => {
      const short = 'k'.repeat(4) + 'z'.repeat(5);
      const withEmail = `cliente${randomBytes(6).toString('hex')}`;

      await expect(
        service.changePassword(2, { currentPassword, newPassword: short }),
      ).rejects.toThrow(/ter pelo menos 12 caracteres/);
      await expect(
        service.changePassword(2, { currentPassword, newPassword: withEmail }),
      ).rejects.toThrow(/não conter o início do próprio e-mail/);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('answers 404 when the account no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(2, {
          currentPassword,
          newPassword: strongPassword(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('profile', () => {
    it('never selects the password hash or token version', async () => {
      await service.getProfile(2);

      const { select } = (
        prisma.user.findUnique.mock.calls[0] as [
          { select: Record<string, boolean> },
        ]
      )[0];
      expect(select).not.toHaveProperty('password');
      expect(select).not.toHaveProperty('tokenVersion');
    });

    it('only updates the name', async () => {
      await service.updateProfile(2, { name: 'Novo nome' });

      expect(updateData()).toEqual({ name: 'Novo nome' });
    });
  });
});
