import { Transform } from 'class-transformer';

/**
 * "true" e "false" de query string ou multipart viram boolean; o resto passa
 * como veio, para o IsBoolean recusar.
 */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );
