import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  WebhookKeysService,
  generateWebhookKey,
  hashWebhookKey,
} from './webhook-keys.service';

type StoredKey = {
  id: number;
  clientId: number;
  name: string;
  prefix: string;
  keyHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  client: { role: UserRole };
};

describe('WebhookKeysService', () => {
  let prisma: {
    webhookKey: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let service: WebhookKeysService;

  // Chaves geradas em tempo de execução: nada parecido com credencial no código.
  const storedFor = (
    key: string,
    overrides: Partial<StoredKey> = {},
  ): StoredKey => ({
    id: 7,
    clientId: 2,
    name: 'ERP',
    prefix: key.split('_')[1],
    keyHash: hashWebhookKey(key),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    lastUsedAt: null,
    revokedAt: null,
    client: { role: UserRole.CLIENT },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      webhookKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 7, ...args.data }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: UserRole.CLIENT }),
      },
    };
    service = new WebhookKeysService(prisma as unknown as PrismaService);
  });

  describe('generateWebhookKey', () => {
    it('builds itk_<12 hex>_<43 base64url> keys that differ every time', () => {
      const first = generateWebhookKey();
      const second = generateWebhookKey();

      expect(first.key).toMatch(/^itk_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
      expect(first.key.startsWith(`itk_${first.prefix}_`)).toBe(true);
      expect(first.key).not.toBe(second.key);
      expect(first.prefix).not.toBe(second.prefix);
    });
  });

  describe('authenticate', () => {
    it('accepts a valid key and returns its client', async () => {
      const { key } = generateWebhookKey();
      prisma.webhookKey.findUnique.mockResolvedValue(storedFor(key));

      await expect(service.authenticate(key)).resolves.toEqual({
        id: 7,
        clientId: 2,
      });
      expect(prisma.webhookKey.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { prefix: key.split('_')[1] } }),
      );
    });

    it('rejects a key whose secret does not match the stored hash', async () => {
      const { key } = generateWebhookKey();
      const other = generateWebhookKey().key;
      // Mesmo prefixo, segredo de outra chave.
      const forged = `itk_${key.split('_')[1]}_${other.slice(other.length - 43)}`;
      prisma.webhookKey.findUnique.mockResolvedValue(storedFor(key));

      await expect(service.authenticate(forged)).resolves.toBeNull();
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['malformed', 'not-a-webhook-key'],
    ])('rejects a %s key without querying the database', async (_, key) => {
      await expect(service.authenticate(key)).resolves.toBeNull();

      expect(prisma.webhookKey.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown prefix', async () => {
      await expect(
        service.authenticate(generateWebhookKey().key),
      ).resolves.toBeNull();
    });

    it('rejects a revoked key', async () => {
      const { key } = generateWebhookKey();
      prisma.webhookKey.findUnique.mockResolvedValue(
        storedFor(key, { revokedAt: new Date() }),
      );

      await expect(service.authenticate(key)).resolves.toBeNull();
    });

    it('rejects a key whose owner is no longer a client', async () => {
      const { key } = generateWebhookKey();
      prisma.webhookKey.findUnique.mockResolvedValue(
        storedFor(key, { client: { role: UserRole.ADMIN } }),
      );

      await expect(service.authenticate(key)).resolves.toBeNull();
    });

    it('records the use when the last one is older than a minute', async () => {
      const { key } = generateWebhookKey();
      prisma.webhookKey.findUnique.mockResolvedValue(
        storedFor(key, { lastUsedAt: new Date(Date.now() - 5 * 60_000) }),
      );

      await service.authenticate(key);

      expect(prisma.webhookKey.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { lastUsedAt: expect.any(Date) as Date },
      });
    });

    it('skips the write when the key was used in the last minute', async () => {
      const { key } = generateWebhookKey();
      prisma.webhookKey.findUnique.mockResolvedValue(
        storedFor(key, { lastUsedAt: new Date() }),
      );

      await service.authenticate(key);

      expect(prisma.webhookKey.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('stores only the hash and returns the full key once', async () => {
      const created = await service.create(2, 'ERP produção');
      const data = (
        prisma.webhookKey.create.mock.calls[0] as [
          { data: Record<string, unknown>; select: Record<string, boolean> },
        ]
      )[0];

      expect(data.data).toEqual({
        clientId: 2,
        name: 'ERP produção',
        prefix: created.prefix,
        keyHash: hashWebhookKey(created.key),
      });
      expect(data.data).not.toHaveProperty('key');
      expect(data.select).not.toHaveProperty('keyHash');
      expect(created.key).toMatch(new RegExp(`^itk_${created.prefix}_`));
    });

    it('creates a key that authenticates afterwards', async () => {
      const created = await service.create(2, 'ERP');
      prisma.webhookKey.findUnique.mockResolvedValue(
        storedFor(created.key, { prefix: created.prefix }),
      );

      await expect(service.authenticate(created.key)).resolves.toEqual({
        id: 7,
        clientId: 2,
      });
    });

    it.each([
      ['an unknown user', null],
      ['an admin', { role: UserRole.ADMIN }],
    ])('refuses to create a key for %s', async (_, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.create(1, 'ERP')).rejects.toThrow(NotFoundException);
      expect(prisma.webhookKey.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it("lists the client's keys without the hash", async () => {
      await service.list(2);

      const args = (
        prisma.webhookKey.findMany.mock.calls[0] as [
          { where: unknown; select: Record<string, boolean> },
        ]
      )[0];
      expect(args.where).toEqual({ clientId: 2 });
      expect(args.select).not.toHaveProperty('keyHash');
    });
  });

  describe('revoke', () => {
    it('marks the key as revoked', async () => {
      prisma.webhookKey.findFirst.mockResolvedValue({ id: 7, revokedAt: null });

      await service.revoke(2, 7);

      expect(prisma.webhookKey.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7, clientId: 2 } }),
      );
      expect(prisma.webhookKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: { revokedAt: expect.any(Date) as Date },
        }),
      );
    });

    it('keeps the original date when the key is already revoked', async () => {
      const revoked = { id: 7, revokedAt: new Date('2026-10-02T00:00:00Z') };
      prisma.webhookKey.findFirst.mockResolvedValue(revoked);

      await expect(service.revoke(2, 7)).resolves.toBe(revoked);
      expect(prisma.webhookKey.update).not.toHaveBeenCalled();
    });

    it("answers 404 for another client's key", async () => {
      await expect(service.revoke(3, 7)).rejects.toThrow(NotFoundException);
      expect(prisma.webhookKey.update).not.toHaveBeenCalled();
    });
  });
});
