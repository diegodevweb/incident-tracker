export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;

export const MAX_INCIDENT_ATTACHMENTS = 5;
export const MAX_CORRECTIVE_ATTACHMENTS = 6;

// Tamanhos das colunas VARCHAR(191) do Prisma/MySQL e do campo TEXT usado nos DTOs.
export const MAX_VARCHAR_LENGTH = 191;
export const MAX_LONG_TEXT_LENGTH = 10_000;

export const uploadLimits = (maxFiles: number) => ({
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES, files: maxFiles },
});

// Requisições por IP por minuto. Uploads são caros; o webhook recebe rajadas legítimas de erros.
export const UPLOAD_THROTTLE = { limit: 20, ttl: 60_000 };
export const WEBHOOK_THROTTLE = { limit: 600, ttl: 60_000 };
