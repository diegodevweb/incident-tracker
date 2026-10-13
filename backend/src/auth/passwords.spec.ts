import * as bcrypt from 'bcrypt';
import { checkPasswordPolicy } from './password-policy';
import { generateTemporaryPassword, hashPassword } from './passwords';

describe('passwords', () => {
  it('generates temporary passwords that pass the policy and never repeat', () => {
    const passwords = Array.from({ length: 50 }, () =>
      generateTemporaryPassword('cliente@example.com'),
    );

    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{24}$/);
      expect(
        checkPasswordPolicy(password, { email: 'cliente@example.com' }),
      ).toEqual([]);
    }
    expect(new Set(passwords).size).toBe(passwords.length);
  });

  it('hashes with bcrypt cost 10', async () => {
    const password = generateTemporaryPassword('cliente@example.com');
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$2b\$10\$/);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
  });
});
