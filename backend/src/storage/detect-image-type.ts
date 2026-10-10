export type DetectedImageType = {
  mime: 'image/png' | 'image/jpeg';
  extension: 'png' | 'jpg';
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const startsWith = (buffer: Buffer, signature: number[]) =>
  buffer.length >= signature.length &&
  signature.every((byte, index) => buffer[index] === byte);

/**
 * Identifica o tipo pelos primeiros bytes do arquivo, ignorando o mimetype e a
 * extensão informados pelo cliente. Só reconhece os formatos aceitos nos uploads.
 */
export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return { mime: 'image/png', extension: 'png' };
  }

  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  return null;
}
