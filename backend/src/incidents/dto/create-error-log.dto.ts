import {
  IsEnum,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentLevel, IncidentSource, IncidentStatus } from '@prisma/client';

export class CreateErrorLogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsEnum(IncidentLevel)
  level?: IncidentLevel;

  @IsString()
  @IsNotEmpty()
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
