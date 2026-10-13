import { Transform } from 'class-transformer';

/** Tira espaços das pontas antes da validação (" " vira "" e falha no IsNotEmpty). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** E-mail sem espaços e em minúsculas, como o login procura. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
