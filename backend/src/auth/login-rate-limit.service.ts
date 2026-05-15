import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitEntry = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil?: number;
};

@Injectable()
export class LoginRateLimitService {
  private readonly attempts = new Map<string, RateLimitEntry>();
  private readonly maxAttempts = this.readNumberEnv(
    'AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
    5,
  );
  private readonly windowMs = this.readNumberEnv(
    'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
    15 * 60 * 1000,
  );
  private readonly blockDurationMs = this.readNumberEnv(
    'AUTH_LOGIN_RATE_LIMIT_BLOCK_MS',
    this.windowMs,
  );

  check(key: string) {
    const entry = this.getActiveEntry(key);

    if (entry?.blockedUntil && entry.blockedUntil > Date.now()) {
      throw new HttpException(
        'Muitas tentativas de login. Tente novamente em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registerFailure(key: string) {
    const now = Date.now();
    const entry = this.getActiveEntry(key);

    if (!entry) {
      this.attempts.set(key, {
        attempts: 1,
        windowStartedAt: now,
      });
      return;
    }

    entry.attempts += 1;

    if (entry.attempts >= this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
    }

    this.attempts.set(key, entry);
  }

  reset(key: string) {
    this.attempts.delete(key);
  }

  buildKey(ipAddress: string, email: string) {
    return `${ipAddress.trim().toLowerCase()}:${email.trim().toLowerCase()}`;
  }

  private getActiveEntry(key: string) {
    const entry = this.attempts.get(key);

    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    const blockExpired = entry.blockedUntil && entry.blockedUntil <= now;
    const windowExpired = entry.windowStartedAt + this.windowMs <= now;

    if (blockExpired || windowExpired) {
      this.attempts.delete(key);
      return undefined;
    }

    return entry;
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
