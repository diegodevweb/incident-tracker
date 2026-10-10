import {
  IsEnum,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentLevel, IncidentSource, IncidentStatus } from '@prisma/client';
import { MAX_VARCHAR_LENGTH } from '../limits';

export class CreateErrorLogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  message!: string;

  @IsOptional()
  @IsEnum(IncidentLevel)
  level?: IncidentLevel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  environment!: string;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentLevel)
  priority?: IncidentLevel;

  @IsOptional()
  @IsEnum(IncidentSource)
  source?: IncidentSource;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
