import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitEntry = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil?: number;
};

type Scope = 'pair' | 'ip' | 'account';

const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_TRACKED_ENTRIES = 10_000;

/**
 * Limita tentativas de login em três escopos, para que nenhum deles sozinho
 * trave a conta de outra pessoa nem permita adivinhar senhas à vontade:
 * - pair: IP + e-mail (5 por padrão), o mais curto;
 * - ip: todas as contas a partir de um mesmo IP (30), contra varredura de e-mails;
 * - account: um e-mail a partir de qualquer IP (20), contra ataque distribuído.
 *
 * O estado fica em memória: zera ao reiniciar e não é compartilhado entre
 * instâncias. Com mais de uma instância, trocar por um storage compartilhado.
 */
@Injectable()
export class LoginRateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();
  private lastSweepAt = Date.now();

  private readonly windowMs = this.readNumberEnv(
    'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
    15 * 60 * 1000,
  );
  private readonly blockDurationMs = this.readNumberEnv(
    'AUTH_LOGIN_RATE_LIMIT_BLOCK_MS',
    this.windowMs,
  );
  private readonly maxAttempts: Record<Scope, number> = {
    pair: this.readNumberEnv('AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 5),
    ip: this.readNumberEnv('AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP', 30),
    account: this.readNumberEnv(
      'AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_ACCOUNT',
      20,
    ),
  };

  get trackedEntries() {
    return this.entries.size;
  }

  check(ipAddress: string, email: string) {
    for (const key of this.keysFor(ipAddress, email)) {
      const entry = this.getActiveEntry(key.value);

      if (entry?.blockedUntil && entry.blockedUntil > Date.now()) {
        throw new HttpException(
          'Muitas tentativas de login. Tente novamente em alguns minutos.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  registerFailure(ipAddress: string, email: string) {
    const now = Date.now();

    this.sweepIfDue(now);

    for (const key of this.keysFor(ipAddress, email)) {
      const entry = this.getActiveEntry(key.value);

      if (!entry) {
        this.entries.set(key.value, { attempts: 1, windowStartedAt: now });
        this.blockIfOverLimit(key.value, key.scope, now);
        continue;
      }

      entry.attempts += 1;
      this.blockIfOverLimit(key.value, key.scope, now);
    }

    this.evictOldestAboveCap();
  }

  /** Um login correto limpa só o par IP+e-mail; os limites por IP e por conta expiram sozinhos. */
  reset(ipAddress: string, email: string) {
    this.entries.delete(this.keysFor(ipAddress, email)[0].value);
  }

  private keysFor(ipAddress: string, email: string) {
    const ip = ipAddress.trim().toLowerCase();
    const account = email.trim().toLowerCase();

    return [
      { scope: 'pair' as const, value: `pair:${ip}:${account}` },
      { scope: 'ip' as const, value: `ip:${ip}` },
      { scope: 'account' as const, value: `account:${account}` },
    ];
  }

  private blockIfOverLimit(key: string, scope: Scope, now: number) {
    const entry = this.entries.get(key);

    if (entry && entry.attempts >= this.maxAttempts[scope]) {
      entry.blockedUntil = now + this.blockDurationMs;
    }
  }

  private getActiveEntry(key: string) {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry, Date.now())) {
      this.entries.delete(key);
      return undefined;
    }

    return entry;
  }

  private isExpired(entry: RateLimitEntry, now: number) {
    // Enquanto bloqueada, a entrada vive até o fim do bloqueio, mesmo que a janela já tenha acabado.
    if (entry.blockedUntil) {
      return entry.blockedUntil <= now;
    }

    return entry.windowStartedAt + this.windowMs <= now;
  }

  private sweepIfDue(now: number) {
    if (now - this.lastSweepAt < SWEEP_INTERVAL_MS) {
      return;
    }

    this.lastSweepAt = now;

    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry, now)) {
        this.entries.delete(key);
      }
    }
  }

  private evictOldestAboveCap() {
    for (const key of this.entries.keys()) {
      if (this.entries.size <= MAX_TRACKED_ENTRIES) {
        return;
      }

      this.entries.delete(key);
    }
  }

  private readNumberEnv(name: string, fallback: number) {
    const rawValue = process.env[name];

    if (!rawValue) {
      return fallback;
    }

    const parsedValue = Number(rawValue);

    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : fallback;
  }
}
