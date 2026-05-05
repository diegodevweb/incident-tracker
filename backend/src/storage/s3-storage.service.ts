import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from './storage.config';
import {
  StorageService,
  UploadObjectInput,
  UploadObjectResult,
} from './storage.types';

@Injectable()
export class S3StorageService extends StorageService {
  private readonly client: S3Client;

  constructor(private readonly storageConfig: StorageConfig) {
    super();

    this.client = new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      forcePathStyle: storageConfig.forcePathStyle,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  async uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );

    return {
      key: input.key,
    };
  }

  async getDownloadUrl(key: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: key,
      }),
      {
        expiresIn: this.storageConfig.signedUrlExpiresInSeconds,
      },
    );
  }

  private async ensureBucketExists() {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.storageConfig.bucket,
        }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.storageConfig.bucket,
        }),
      );
    }
  }
}
