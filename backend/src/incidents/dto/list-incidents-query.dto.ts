import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IncidentSource, IncidentStatus } from '@prisma/client';
import { MAX_VARCHAR_LENGTH } from '../limits';

export class ListIncidentsQueryDto {
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
