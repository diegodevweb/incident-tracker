import { extname } from 'node:path';

const MAX_EXTENSION_LENGTH = 10;

/**
 * Limita o tamanho do nome mantendo a extensão, para que o nome gravado e a
 * chave do objeto caibam nas colunas VARCHAR(191) depois do upload já feito.
 */
export function truncateFilename(filename: string, maxLength: number): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const extension = extname(filename);
  const keptExtension =
    extension.length <= MAX_EXTENSION_LENGTH ? extension : '';

  return filename.slice(0, maxLength - keptExtension.length) + keptExtension;
}
