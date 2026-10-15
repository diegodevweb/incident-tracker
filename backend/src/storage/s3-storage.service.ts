import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
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
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
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

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: key,
      }),
    );
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
    const Bucket = this.storageConfig.bucket;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket }));
      return;
    } catch (error) {
      if (!this.storageConfig.createBucketOnBoot) {
        // Só os anexos dependem do storage: a API sobe mesmo assim, em vez de
        // cair a cada reinício por uma conferência que a chave pode não ter
        // permissão para fazer.
        const status = (error as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode;
        const reason = [
          error instanceof Error ? error.name : 'erro desconhecido',
          status ? `HTTP ${status}` : undefined,
        ]
          .filter(Boolean)
          .join(', ');

        this.logger.warn(
          `Não foi possível conferir o bucket "${Bucket}" (${reason}). Em produção a API não cria o bucket: ele precisa existir e a chave precisa poder ler e gravar objetos nele. Enquanto isso, anexos vão falhar.`,
        );
        return;
      }
    }

    await this.client.send(new CreateBucketCommand({ Bucket }));
  }
}
