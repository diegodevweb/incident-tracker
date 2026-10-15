import { randomBytes } from 'node:crypto';
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import { StorageConfig } from './storage.config';

// Montadas em tempo de execução: nenhuma credencial literal no arquivo.
const BASE_ENV: Record<string, string | undefined> = {
  STORAGE_REGION: 'auto',
  STORAGE_BUCKET: 'bucket-de-teste',
  STORAGE_ACCESS_KEY_ID: randomBytes(8).toString('hex'),
  STORAGE_SECRET_ACCESS_KEY: randomBytes(16).toString('hex'),
};

const configFor = (nodeEnv?: string) => {
  const env: Record<string, string | undefined> = {
    ...BASE_ENV,
    NODE_ENV: nodeEnv,
  };

  return new StorageConfig({
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      const value = env[key];

      if (value === undefined) {
        throw new Error(`${key} não definida`);
      }

      return value;
    },
  } as unknown as ConfigService);
};

const awsError = (name: string, httpStatusCode?: number) =>
  Object.assign(new Error(name), { name, $metadata: { httpStatusCode } });

describe('StorageConfig.createBucketOnBoot', () => {
  it('is off in production only', () => {
    expect(configFor('production').createBucketOnBoot).toBe(false);
    expect(configFor('development').createBucketOnBoot).toBe(true);
    expect(configFor('test').createBucketOnBoot).toBe(true);
    expect(configFor(undefined).createBucketOnBoot).toBe(true);
  });
});

describe('S3StorageService bucket check on boot', () => {
  const send = jest.fn<Promise<unknown>, [object]>();
  let warn: jest.SpyInstance;

  const serviceFor = (nodeEnv?: string) => {
    const service = new S3StorageService(configFor(nodeEnv));

    // Troca o cliente real por um que só registra os comandos.
    Object.assign(service, { client: { send } });
    return service;
  };

  const sentCommands = () => send.mock.calls.map(([command]) => command);
  const warning = () => String((warn.mock.calls as unknown[][])[0]?.[0]);

  beforeEach(() => {
    send.mockReset();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('outside production', () => {
    it('only checks a bucket that already exists', async () => {
      send.mockResolvedValue({});

      await serviceFor('development').onModuleInit();

      expect(sentCommands()).toHaveLength(1);
      expect(sentCommands()[0]).toBeInstanceOf(HeadBucketCommand);
    });

    it('creates the bucket when the check fails', async () => {
      send.mockRejectedValueOnce(awsError('NotFound')).mockResolvedValue({});

      await serviceFor('test').onModuleInit();

      const [check, create] = sentCommands();

      expect(check).toBeInstanceOf(HeadBucketCommand);
      expect(create).toBeInstanceOf(CreateBucketCommand);
      expect((create as CreateBucketCommand).input).toEqual({
        Bucket: 'bucket-de-teste',
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('still fails when the bucket can be neither found nor created', async () => {
      send
        .mockRejectedValueOnce(awsError('NotFound'))
        .mockRejectedValueOnce(awsError('AccessDenied'));

      await expect(serviceFor('development').onModuleInit()).rejects.toThrow(
        'AccessDenied',
      );
    });
  });

  describe('in production', () => {
    it('only checks a bucket that already exists, quietly', async () => {
      send.mockResolvedValue({});

      await serviceFor('production').onModuleInit();

      expect(sentCommands()).toHaveLength(1);
      expect(sentCommands()[0]).toBeInstanceOf(HeadBucketCommand);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each(['AccessDenied', 'Forbidden', 'NotFound'])(
      'never creates the bucket and still boots when the check fails with %s',
      async (name) => {
        send.mockRejectedValue(awsError(name));

        await expect(
          serviceFor('production').onModuleInit(),
        ).resolves.toBeUndefined();

        expect(sentCommands()).toHaveLength(1);
        expect(sentCommands()[0]).toBeInstanceOf(HeadBucketCommand);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warning()).toContain('bucket-de-teste');
        expect(warning()).toContain(name);
      },
    );

    it('shows the HTTP status, since the SDK names a bodiless HEAD error "Unknown"', async () => {
      send.mockRejectedValue(awsError('Unknown', 403));

      await serviceFor('production').onModuleInit();

      expect(warning()).toContain('Unknown, HTTP 403');
    });

    it('does not leak the credentials into the warning', async () => {
      send.mockRejectedValue(awsError('AccessDenied'));

      await serviceFor('production').onModuleInit();

      expect(warning()).not.toContain(BASE_ENV.STORAGE_ACCESS_KEY_ID ?? '');
      expect(warning()).not.toContain(BASE_ENV.STORAGE_SECRET_ACCESS_KEY ?? '');
    });
  });
});
