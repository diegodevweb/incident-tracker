import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { checkPasswordPolicy } from './password-policy';

// Mesmo custo do seed e do hash de comparação do login (DUMMY_PASSWORD_HASH).
const BCRYPT_COST = 10;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Senha temporária para o admin repassar ao cliente: 18 bytes aleatórios em
 * base64url (24 caracteres). O cliente troca no primeiro acesso.
 */
export function generateTemporaryPassword(email: string) {
  for (;;) {
    const password = randomBytes(18).toString('base64url');

    // Aleatória, quase sempre passa; o laço só cobre o caso raro de cair numa
    // regra da política (ex.: conter o início do e-mail).
    if (checkPasswordPolicy(password, { email }).length === 0) {
      return password;
    }
  }
}
