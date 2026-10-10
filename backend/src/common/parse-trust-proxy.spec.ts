import { parseTrustProxy } from './parse-trust-proxy';

describe('parseTrustProxy', () => {
  it('defaults to 0 (trust nobody) when unset or blank', () => {
    expect(parseTrustProxy(undefined)).toBe(0);
    expect(parseTrustProxy('')).toBe(0);
    expect(parseTrustProxy('  ')).toBe(0);
  });

  it('parses the number of trusted proxies', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('0')).toBe(0);
  });

  it.each(['true', '-1', '1.5', 'abc', '11', '10.0.0.0/8'])(
    'refuses %s instead of silently trusting too much',
    (value) => {
      expect(() => parseTrustProxy(value)).toThrow('TRUST_PROXY');
    },
  );
});
