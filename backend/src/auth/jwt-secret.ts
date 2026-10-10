import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_BYTES = 32;

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.getOrThrow<string>('JWT_SECRET');

  if (Buffer.byteLength(secret) < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET precisa ter pelo menos ${MIN_JWT_SECRET_BYTES} bytes (gere um com: openssl rand -base64 48)`,
    );
  }

  return secret;
}
