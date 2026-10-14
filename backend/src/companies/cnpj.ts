import { Transform } from 'class-transformer';
import { ValidationOptions, registerDecorator } from 'class-validator';

// CNPJ numérico ou alfanumérico (emitido pela Receita desde julho de 2026):
// 12 caracteres [0-9A-Z] e 2 dígitos verificadores. No cálculo, cada caractere
// vale o código ASCII menos 48 ("0" = 0, "9" = 9, "A" = 17), com os mesmos
// pesos e o mesmo módulo 11 do CNPJ numérico.
const CNPJ_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Sem pontuação nem espaços, letras em maiúsculas: é assim que se guarda. */
export function normalizeCnpj(value: string) {
  return value.replace(/[.\-/\s]/g, '').toUpperCase();
}

function checkDigit(base: string) {
  let sum = 0;
  let weight = 2;

  for (let index = base.length - 1; index >= 0; index--) {
    sum += (base.charCodeAt(index) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Recebe o CNPJ já normalizado. */
export function isValidCnpj(cnpj: string) {
  // Todos os caracteres iguais passam no cálculo, mas não existem.
  if (!CNPJ_PATTERN.test(cnpj) || /^(.)\1+$/.test(cnpj)) {
    return false;
  }

  const base = cnpj.slice(0, 12);
  const first = checkDigit(base);
  const second = checkDigit(`${base}${first}`);

  return cnpj.endsWith(`${first}${second}`);
}

/** Normaliza o CNPJ do corpo; vazio vira null (sem CNPJ). */
export const NormalizeCnpj = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const cnpj = normalizeCnpj(value);
    return cnpj === '' ? null : cnpj;
  });

export function IsCnpj(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCnpj',
      target: target.constructor,
      propertyName,
      options: { message: 'CNPJ inválido', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCnpj(value),
      },
    });
}
