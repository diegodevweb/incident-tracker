import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageConfig {
  constructor(private readonly configService: ConfigService) {}

  get region() {
    return this.configService.getOrThrow<string>('STORAGE_REGION');
  }

  get bucket() {
    return this.configService.getOrThrow<string>('STORAGE_BUCKET');
  }

  get endpoint() {
    return this.configService.get<string>('STORAGE_ENDPOINT');
  }

  get accessKeyId() {
    return this.configService.getOrThrow<string>('STORAGE_ACCESS_KEY_ID');
  }

  get secretAccessKey() {
    return this.configService.getOrThrow<string>('STORAGE_SECRET_ACCESS_KEY');
  }

  get forcePathStyle() {
    return this.configService.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true';
  }

  get signedUrlExpiresInSeconds() {
    return Number(
      this.configService.get<string>('STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS') ??
        '900',
    );
  }
}
