import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('LoginRateLimitService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '3';
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = '1000';
    process.env.AUTH_LOGIN_RATE_LIMIT_BLOCK_MS = '2000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('blocks after the configured number of failed attempts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);

    const service = new LoginRateLimitService();
    const key = service.buildKey('127.0.0.1', 'user@example.com');

    service.check(key);
    service.registerFailure(key);
    service.check(key);
    service.registerFailure(key);
    service.check(key);
    service.registerFailure(key);

    try {
      service.check(key);
      fail('Expected the rate limiter to block the request');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('resets the counter after a successful login', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100);

    const service = new LoginRateLimitService();
    const key = service.buildKey('127.0.0.1', 'user@example.com');

    service.registerFailure(key);
    service.registerFailure(key);
    service.reset(key);

    expect(() => service.check(key)).not.toThrow();
  });

  it('allows new attempts after the block duration expires', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(100);

    const service = new LoginRateLimitService();
    const key = service.buildKey('127.0.0.1', 'user@example.com');

    service.registerFailure(key);
    service.registerFailure(key);
    service.registerFailure(key);

    expect(() => service.check(key)).toThrow(HttpException);

    nowSpy.mockReturnValue(2201);

    expect(() => service.check(key)).not.toThrow();
  });
});
