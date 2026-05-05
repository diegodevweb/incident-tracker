import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentStatus } from '@prisma/client';

class CorrectiveActionAttachmentDto {
  @IsString()
  filename!: string;

  @IsString()
  mimeType!: string;

  @IsUrl({
    require_tld: false,
  })
  url!: string;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsString()
  correctiveActions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CorrectiveActionAttachmentDto)
  correctiveActionAttachments?: CorrectiveActionAttachmentDto[];
}
