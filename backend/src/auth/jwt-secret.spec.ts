import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  it('throws when JWT_SECRET is missing', () => {
    expect(() => getJwtSecret(new ConfigService({}))).toThrow();
  });

  it('throws when JWT_SECRET is shorter than 32 bytes', () => {
    const config = new ConfigService({ JWT_SECRET: 'short-secret' });

    expect(() => getJwtSecret(config)).toThrow('pelo menos 32 bytes');
  });

  it('returns the secret when it is long enough', () => {
    const secret = 'a'.repeat(32);

    expect(getJwtSecret(new ConfigService({ JWT_SECRET: secret }))).toBe(
      secret,
    );
  });
});
