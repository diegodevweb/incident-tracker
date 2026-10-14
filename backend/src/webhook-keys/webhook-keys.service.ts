import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  companyId: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} satisfies Prisma.WebhookKeySelect;

export type AuthenticatedWebhookKey = { id: number; companyId: number };

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

  /** Devolve a chave e a empresa dela, ou null se a chave não vale. */
  async authenticate(
    presentedKey: string | undefined,
  ): Promise<AuthenticatedWebhookKey | null> {
    const prefix = presentedKey && WEBHOOK_KEY_PATTERN.exec(presentedKey)?.[1];

    if (!presentedKey || !prefix) {
      return null;
    }

    const stored = await this.prisma.webhookKey.findUnique({
      where: { prefix },
      include: { company: { select: { disabledAt: true } } },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.company.disabledAt ||
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

    return { id: stored.id, companyId: stored.companyId };
  }

  async create(companyId: number, name: string) {
    await this.assertCompany(companyId);

    const { prefix, key } = generateWebhookKey();
    const created = await this.prisma.webhookKey.create({
      data: { companyId, name, prefix, keyHash: hashWebhookKey(key) },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
    });

    // Única vez em que a chave completa aparece: o banco só tem o hash.
    return { ...created, key };
  }

  async list(companyId: number) {
    await this.assertCompany(companyId);

    return this.prisma.webhookKey.findMany({
      where: { companyId },
      select: PUBLIC_WEBHOOK_KEY_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async revoke(companyId: number, keyId: number) {
    const key = await this.prisma.webhookKey.findFirst({
      where: { id: keyId, companyId },
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

  private async assertCompany(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
  }
}
