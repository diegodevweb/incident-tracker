import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.types';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('test-upload')
  @UseInterceptors(FileInterceptor('file'))
  async testUpload(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo "file"');
    }

    const key = this.buildObjectKey(file.originalname);
    const { key: uploadedKey } = await this.storageService.uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    const url = await this.storageService.getDownloadUrl(uploadedKey);

    return {
      key: uploadedKey,
      url,
      contentType: file.mimetype,
      originalFilename: file.originalname,
      size: file.size,
    };
  }

  private buildObjectKey(filename: string) {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `test-uploads/${randomUUID()}-${safeFilename}`;
  }
}
