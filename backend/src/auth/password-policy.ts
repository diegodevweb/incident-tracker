export const MIN_PASSWORD_LENGTH = 12;
// O bcrypt só usa os primeiros 72 bytes: acima disso senhas diferentes seriam equivalentes.
export const MAX_PASSWORD_BYTES = 72;

// Senhas muito comuns (já normalizadas: minúsculas, só letras e números). Não substitui
// uma consulta a base de senhas vazadas; só barra o óbvio.
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  'passw0rd1234',
  'qwertyuiop',
  'qwertyuiopas',
  'qwerty123456',
  'abc123456789',
  'iloveyou1234',
  'welcome12345',
  'letmein12345',
  'administrator',
  'admin123456',
  'admin1234567',
  'adminadmin12',
  'changeme1234',
  'trustno1trustno1',
  'senha1234567',
  'senha123456',
  'minhasenha123',
  'mudar123456',
  'brasil123456',
  'incidenttracker',
  'incidenttracker1',
]);

const MIN_EMAIL_PART_LENGTH = 4;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const isSingleRepeatedCharacter = (password: string) =>
  new Set(password).size === 1;

const isAscendingOrDescendingRun = (values: number[], modulo?: number) => {
  const diff = (current: number, previous: number) =>
    modulo ? (current - previous + modulo) % modulo : current - previous;
  const step = diff(values[1], values[0]);
  const isUnitStep = modulo
    ? step === 1 || step === modulo - 1
    : Math.abs(step) === 1;

  return (
    isUnitStep &&
    values.every(
      (value, index) => index === 0 || diff(value, values[index - 1]) === step,
    )
  );
};

// Em sequências só de dígitos o 0 vem depois do 9 (1234567890...).
const isSequentialRun = (password: string) =>
  /^\d+$/.test(password)
    ? isAscendingOrDescendingRun([...password].map(Number), 10)
    : isAscendingOrDescendingRun(
        [...password].map((char) => char.codePointAt(0) ?? 0),
      );

/**
 * Devolve os problemas encontrados na senha (lista vazia = aceita). Sem regras de
 * composição (maiúscula, símbolo...): comprimento e evitar o óbvio pesam mais.
 */
export function checkPasswordPolicy(
  password: string,
  context: { email?: string } = {},
): string[] {
  const problems: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    problems.push(`ter no máximo ${MAX_PASSWORD_BYTES} bytes`);
  }

  if (password.length > 0) {
    if (isSingleRepeatedCharacter(password) || isSequentialRun(password)) {
      problems.push('não ser uma sequência ou repetição de caracteres');
    }

    const normalizedPassword = normalize(password);

    if (COMMON_PASSWORDS.has(normalizedPassword)) {
      problems.push('não ser uma senha comum');
    }

    const emailLocalPart = normalize(context.email?.split('@')[0] ?? '');

    if (
      emailLocalPart.length >= MIN_EMAIL_PART_LENGTH &&
      normalizedPassword.includes(emailLocalPart)
    ) {
      problems.push('não conter o início do próprio e-mail');
    }
  }

  return problems;
}
