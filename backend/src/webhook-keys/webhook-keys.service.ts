import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Formato: itk_<prefixo>_<segredo>. O prefixo (12 hex) é público e localiza a
// chave no banco; o segredo tem 32 bytes aleatórios. Como a chave inteira é
// aleatória, um SHA-256 simples basta para guardá-la (não é senha de pessoa).
const WEBHOOK_KEY_PATTERN = /^itk_([0-9a-f]{12})_[A-Za-z0-9_-]{43}$/;

// lastUsedAt é só indicativo: atualizar no máximo uma vez por minuto evita uma
// escrita no banco a cada chamada do webhook.
const LAST_USED_RESOLUTION_MS = 60_000;

// O que sai nas respostas da API. O hash nunca sai.
const PUBLIC_WEBHOOK_KEY_SELECT = {
  id: true,
  clientId: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} satisfies Prisma.WebhookKeySelect;

export type AuthenticatedWebhookKey = { id: number; clientId: number };

export function generateWebhookKey() {
  const prefix = randomBytes(6).toString('hex');
  const secret = randomBytes(32).toString('base64url');

  return { prefix, key: `itk_${prefix}_${secret}` };
}

export function hashWebhookKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

@Injectable()
export class WebhookKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devolve a chave e o cliente dela, ou null se a chave não vale. */
  async authenticate(
    presentedKey: string | undefined,
  ): Promise<AuthenticatedWebhookKey | null> {
    const prefix = presentedKey && WEBHOOK_KEY_PATTERN.exec(presentedKey)?.[1];

    if (!presentedKey || !prefix) {
      return null;
    }

    const stored = await this.prisma.webhookKey.findUnique({
      where: { prefix },
      include: { client: { select: { role: true, disabledAt: true } } },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.client.role !== UserRole.CLIENT ||
      stored.client.disabledAt ||
      !this.hashMatches(stored.keyHash, presentedKey)
    ) {
      return null;
    }

    if (
      !stored.lastUsedAt ||
      Date.now() - stored.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS
    ) {
      await this.prisma.webhookKey.update({
        where: { id: stored.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return { id: stored.id, clientId: stored.clientId };
  }

  async create(clientId: number, name: string) {
    await this.assertClient(clientId);

    const { prefix, key } = generateWebhookKey();
    const created = await this.prisma.webhookKey.create({
      data: { clientId, name, prefix, keyHash: hashWebhookKey(key) },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
    });

    // Única vez em que a chave completa aparece: o banco só tem o hash.
    return { ...created, key };
  }

  async list(clientId: number) {
    await this.assertClient(clientId);

    return this.prisma.webhookKey.findMany({
      where: { clientId },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async revoke(clientId: number, keyId: number) {
    const key = await this.prisma.webhookKey.findFirst({
      where: { id: keyId, clientId },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
    });

    if (!key) {
      throw new NotFoundException('Chave de webhook não encontrada');
    }

    if (key.revokedAt) {
      return key;
    }

    return this.prisma.webhookKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
    });
  }

  private hashMatches(storedHash: string, presentedKey: string) {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = createHash('sha256').update(presentedKey).digest();

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private async assertClient(clientId: number) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { role: true },
    });

    if (!client || client.role !== UserRole.CLIENT) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }
}
