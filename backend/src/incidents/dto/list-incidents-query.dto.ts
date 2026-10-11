import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IncidentSource, IncidentStatus } from '@prisma/client';
import { MAX_VARCHAR_LENGTH } from '../limits';
import { MAX_PAGE_SIZE } from '../pagination';

export class ListIncidentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  q?: string;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSource)
  source?: IncidentSource;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  client?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
