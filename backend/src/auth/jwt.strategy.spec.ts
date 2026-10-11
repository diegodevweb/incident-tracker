import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const dbUser = {
    id: 4,
    email: 'db@example.com',
    role: UserRole.CLIENT,
    tokenVersion: 2,
    mustChangePassword: false,
    disabledAt: null as Date | null,
  };
  let findUnique: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(dbUser);
    strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'x'.repeat(40) }),
      { user: { findUnique } } as unknown as PrismaService,
    );
  });

  it('returns the identity stored in the database', async () => {
    await expect(
      strategy.validate({
        sub: 4,
        email: 'old@example.com',
        role: UserRole.ADMIN,
        tv: 2,
      }),
    ).resolves.toEqual({
      sub: 4,
      email: 'db@example.com',
      role: UserRole.CLIENT,
      mustChangePassword: false,
    });
  });

  it('passes on whether the password still has to be changed', async () => {
    findUnique.mockResolvedValue({ ...dbUser, mustChangePassword: true });

    await expect(
      strategy.validate({ sub: 4, email: 'a', role: UserRole.CLIENT, tv: 2 }),
    ).resolves.toMatchObject({ mustChangePassword: true });
  });

  it('rejects a disabled account', async () => {
    findUnique.mockResolvedValue({ ...dbUser, disabledAt: new Date() });

    await expect(
      strategy.validate({ sub: 4, email: 'a', role: UserRole.CLIENT, tv: 2 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user was removed', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 4, email: 'a', role: UserRole.CLIENT, tv: 2 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the token version no longer matches', async () => {
    await expect(
      strategy.validate({ sub: 4, email: 'a', role: UserRole.CLIENT, tv: 1 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token without a version', async () => {
    await expect(
      strategy.validate({
        sub: 4,
        email: 'a',
        role: UserRole.CLIENT,
      } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-numeric subject without querying the database', async () => {
    await expect(
      strategy.validate({
        sub: '4; DROP TABLE' as never,
        email: 'a',
        role: UserRole.CLIENT,
        tv: 2,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).not.toHaveBeenCalled();
  });
});
