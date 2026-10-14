import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, DUMMY_PASSWORD_HASH } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const compare = bcrypt.compare as unknown as jest.Mock;

describe('AuthService', () => {
  const ip = '203.0.113.10';
  const user = {
    id: 7,
    name: 'Cliente',
    email: 'cliente@example.com',
    password: '$2b$10$stored-hash',
    role: UserRole.CLIENT,
    tokenVersion: 3,
    mustChangePassword: false,
    disabledAt: null as Date | null,
    companyId: 5 as number | null,
    company: { disabledAt: null as Date | null } as {
      disabledAt: Date | null;
    } | null,
  };

  let prisma: {
    user: { findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let jwtService: { signAsync: jest.Mock };
  let rateLimit: {
    check: jest.Mock;
    registerFailure: jest.Mock;
    reset: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    compare.mockReset();
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    rateLimit = {
      check: jest.fn(),
      registerFailure: jest.fn(),
      reset: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      rateLimit as unknown as LoginRateLimitService,
    );
  });

  describe('login', () => {
    // Entradas montadas em tempo de execução: não são credenciais de verdade.
    const typedPassword = 'p'.repeat(16);

    it('tells the front when the password is temporary', async () => {
      compare.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        mustChangePassword: true,
      });

      const result = await service.login(
        { email: user.email, password: typedPassword },
        ip,
      );

      expect(result.user.mustChangePassword).toBe(true);
    });

    it('refuses a disabled account only after the password matches', async () => {
      compare.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        disabledAt: new Date(),
      });

      await expect(
        service.login({ email: user.email, password: typedPassword }, ip),
      ).rejects.toThrow(ForbiddenException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(rateLimit.registerFailure).not.toHaveBeenCalled();
    });

    it.each([
      ['its company is disabled', { company: { disabledAt: new Date() } }],
      ['a client has no company', { companyId: null, company: null }],
    ])(
      'refuses the login when %s, after the password matches',
      async (_, changes) => {
        compare.mockResolvedValue(true);
        prisma.user.findUnique.mockResolvedValue({ ...user, ...changes });

        await expect(
          service.login({ email: user.email, password: typedPassword }, ip),
        ).rejects.toThrow(ForbiddenException);
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      },
    );

    it('lets an admin without a company in', async () => {
      compare.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        role: UserRole.ADMIN,
        companyId: null,
        company: null,
      });

      await expect(
        service.login({ email: user.email, password: typedPassword }, ip),
      ).resolves.toMatchObject({ accessToken: 'signed-token' });
    });

    it('answers a disabled account with a wrong password like any failure', async () => {
      compare.mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        disabledAt: new Date(),
      });

      await expect(
        service.login({ email: user.email, password: typedPassword }, ip),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('signs a token carrying the user token version', async () => {
      compare.mockResolvedValue(true);

      const result = await service.login(
        { email: 'Cliente@Example.com', password: 'secret-password' },
        ip,
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 7,
        role: UserRole.CLIENT,
        email: 'cliente@example.com',
        tv: 3,
      });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({
        id: 7,
        name: 'Cliente',
        email: 'cliente@example.com',
        role: UserRole.CLIENT,
        mustChangePassword: false,
      });
      expect(rateLimit.reset).toHaveBeenCalledWith(ip, 'cliente@example.com');
    });

    it('still compares the password against a hash when the e-mail does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' }, ip),
      ).rejects.toThrow(UnauthorizedException);

      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare).toHaveBeenCalledWith('whatever', DUMMY_PASSWORD_HASH);
      expect(rateLimit.registerFailure).toHaveBeenCalledWith(
        ip,
        'ghost@example.com',
      );
    });

    it('never signs a token for an unknown e-mail even if the comparison were true', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      compare.mockResolvedValue(true);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' }, ip),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('answers unknown e-mail and wrong password with the same error', async () => {
      compare.mockResolvedValue(false);
      const wrongPassword = await service
        .login({ email: 'cliente@example.com', password: 'wrong' }, ip)
        .catch((error: UnauthorizedException) => error);

      prisma.user.findUnique.mockResolvedValue(null);
      const unknownEmail = await service
        .login({ email: 'ghost@example.com', password: 'wrong' }, ip)
        .catch((error: UnauthorizedException) => error);

      expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
      expect((unknownEmail as UnauthorizedException).getResponse()).toEqual(
        (wrongPassword as UnauthorizedException).getResponse(),
      );
    });

    it('stops before touching the database when the rate limiter blocks', async () => {
      rateLimit.check.mockImplementation(() => {
        throw new HttpException('blocked', 429);
      });

      await expect(
        service.login({ email: 'cliente@example.com', password: 'x' }, ip),
      ).rejects.toThrow(HttpException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(compare).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('bumps the token version so previous tokens stop working', async () => {
      await service.logout(7);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });

  describe('DUMMY_PASSWORD_HASH', () => {
    it('is a well-formed bcrypt hash that real bcrypt compares without throwing', async () => {
      const actualBcrypt =
        jest.requireActual<typeof import('bcrypt')>('bcrypt');

      await expect(
        actualBcrypt.compare('anything', DUMMY_PASSWORD_HASH),
      ).resolves.toBe(false);
    });
  });
});
