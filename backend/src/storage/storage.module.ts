import { Module } from '@nestjs/common';
import { StorageConfig } from './storage.config';
import { S3StorageService } from './s3-storage.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.types';

@Module({
  controllers: [StorageController],
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
