export type UploadObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type UploadObjectResult = {
  key: string;
};

export abstract class StorageService {
  abstract uploadObject(input: UploadObjectInput): Promise<UploadObjectResult>;
  abstract getDownloadUrl(key: string): Promise<string>;
  abstract deleteObject(key: string): Promise<void>;
}
