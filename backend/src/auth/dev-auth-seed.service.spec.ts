import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DevAuthSeedService } from './dev-auth-seed.service';

describe('DevAuthSeedService', () => {
  const buildService = (
    env: Record<string, string>,
    existingEmails: string[] = [],
  ) => {
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { email: string } }) =>
          Promise.resolve(
            existingEmails.includes(where.email) ? { id: 1 } : null,
          ),
        ),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DevAuthSeedService(
      prisma as unknown as PrismaService,
      new ConfigService(env),
    );

    return { service, prisma };
  };

  const validEnv = {
    SEED_DEV_USERS: 'true',
    SEED_ADMIN_PASSWORD: 'admin-password-123',
    SEED_CLIENT_PASSWORD: 'client-password-123',
  };

  it('does nothing without the explicit SEED_DEV_USERS flag', async () => {
    const { service, prisma } = buildService({
      SEED_ADMIN_PASSWORD: validEnv.SEED_ADMIN_PASSWORD,
      SEED_CLIENT_PASSWORD: validEnv.SEED_CLIENT_PASSWORD,
    });

    await service.onModuleInit();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('never seeds when NODE_ENV is production', async () => {
    const { service, prisma } = buildService({
      ...validEnv,
      NODE_ENV: 'production',
    });

    await service.onModuleInit();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('fails when a seed password is missing', async () => {
    const { service } = buildService({ SEED_DEV_USERS: 'true' });

    await expect(service.onModuleInit()).rejects.toThrow('SEED_ADMIN_PASSWORD');
  });

  it('fails when a seed password is too short', async () => {
    const { service } = buildService({
      ...validEnv,
      SEED_CLIENT_PASSWORD: 'short',
    });

    await expect(service.onModuleInit()).rejects.toThrow(
      'SEED_CLIENT_PASSWORD',
    );
  });

  it('creates both users with example.com emails and hashed passwords', async () => {
    const { service, prisma } = buildService(validEnv);

    await service.onModuleInit();

    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    const created = prisma.user.create.mock.calls.map(
      ([args]: [{ data: { email: string; password: string; role: string } }]) =>
        args.data,
    );
    expect(created.map((user) => user.email)).toEqual([
      'admin@example.com',
      'cliente@example.com',
    ]);
    expect(created.map((user) => user.role)).toEqual(['ADMIN', 'CLIENT']);
    for (const user of created) {
      expect(user.password).toMatch(/^\$2[aby]\$/);
    }
  });

  it('does not overwrite users that already exist', async () => {
    const { service, prisma } = buildService(validEnv, [
      'admin@example.com',
      'cliente@example.com',
    ]);

    await service.onModuleInit();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
