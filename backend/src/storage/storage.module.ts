import { Module } from '@nestjs/common';
import { StorageConfig } from './storage.config';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.types';

@Module({
  providers: [
    StorageConfig,
    S3StorageService,
    {
      provide: StorageService,
      useExisting: S3StorageService,
    },
  ],
  exports: [StorageConfig, StorageService],
})
export class StorageModule {}
