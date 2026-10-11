import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('LoginRateLimitService', () => {
  const originalEnv = { ...process.env };
  const ip = '203.0.113.10';
  const email = 'user@example.com';

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '3';
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = '1000';
    process.env.AUTH_LOGIN_RATE_LIMIT_BLOCK_MS = '2000';
    // Por padrão os limites por IP e por conta ficam fora do caminho dos testes do par IP+e-mail.
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = '1000';
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_ACCOUNT = '1000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const failTimes = (
    service: LoginRateLimitService,
    times: number,
    from = ip,
    account = email,
  ) => {
    for (let i = 0; i < times; i++) {
      service.registerFailure(from, account);
    }
  };

  it('blocks after the configured number of failed attempts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 2);
    expect(() => service.check(ip, email)).not.toThrow();

    failTimes(service, 1);

    try {
      service.check(ip, email);
      fail('Expected the rate limiter to block the request');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('does not lock the account for other people when one IP fails repeatedly', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 3, '198.51.100.7');

    expect(() => service.check('198.51.100.7', email)).toThrow(HttpException);
    expect(() => service.check(ip, email)).not.toThrow();
  });

  it('resets the pair counter after a successful login', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 2);
    service.reset(ip, email);

    expect(() => service.check(ip, email)).not.toThrow();
    failTimes(service, 2);
    expect(() => service.check(ip, email)).not.toThrow();
  });

  it('allows new attempts after the block duration expires', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 3);
    expect(() => service.check(ip, email)).toThrow(HttpException);

    nowSpy.mockReturnValue(2201);

    expect(() => service.check(ip, email)).not.toThrow();
  });

  it('keeps blocking until the block ends even when the counting window already ended', () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = '1000';
    process.env.AUTH_LOGIN_RATE_LIMIT_BLOCK_MS = '5000';
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 3);

    nowSpy.mockReturnValue(1500);
    expect(() => service.check(ip, email)).toThrow(HttpException);

    nowSpy.mockReturnValue(5200);
    expect(() => service.check(ip, email)).not.toThrow();
  });

  it('blocks an IP that sprays failures across many accounts', () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = '4';
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    ['a', 'b', 'c', 'd'].forEach((name) =>
      service.registerFailure(ip, `${name}@example.com`),
    );

    expect(() => service.check(ip, 'new-account@example.com')).toThrow(
      HttpException,
    );
    expect(() =>
      service.check('198.51.100.7', 'new-account@example.com'),
    ).not.toThrow();
  });

  it('blocks an account that is attacked from many IPs', () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_ACCOUNT = '4';
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    ['10', '11', '12', '13'].forEach((last) =>
      service.registerFailure(`203.0.113.${last}`, email),
    );

    expect(() => service.check('198.51.100.7', email)).toThrow(HttpException);
    expect(() =>
      service.check('198.51.100.7', 'other@example.com'),
    ).not.toThrow();
  });

  it('keeps the per-IP count after a successful login', () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = '4';
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 2, ip, 'a@example.com');
    service.reset(ip, 'a@example.com');
    failTimes(service, 2, ip, 'b@example.com');

    expect(() => service.check(ip, 'c@example.com')).toThrow(HttpException);
  });

  it('normalizes case and whitespace when building the keys', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);
    const service = new LoginRateLimitService();

    failTimes(service, 3, ` ${ip} `, ' User@Example.com ');

    expect(() => service.check(ip, email)).toThrow(HttpException);
  });

  describe('memory', () => {
    it('drops expired entries on the next failure after the sweep interval', () => {
      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValue(100);
      const service = new LoginRateLimitService();

      ['a', 'b', 'c'].forEach((name) =>
        service.registerFailure(ip, `${name}@example.com`),
      );
      expect(service.trackedEntries).toBeGreaterThan(3);

      nowSpy.mockReturnValue(100 + 61_000);
      service.registerFailure('198.51.100.7', 'late@example.com');

      expect(service.trackedEntries).toBe(3);
    });

    it('never tracks more than the maximum number of entries', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100);
      const service = new LoginRateLimitService();

      for (let i = 0; i < 4_000; i++) {
        service.registerFailure(
          `10.0.${i % 250}.${i % 200}`,
          `u${i}@example.com`,
        );
      }

      expect(service.trackedEntries).toBeLessThanOrEqual(10_000);
    });
  });
});
