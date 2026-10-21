import { Type } from 'class-transformer';
import {
  IsBoolean,
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
import { ToBoolean } from '../../common/to-boolean';
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

  /** Parte do nome da empresa (só o admin; o cliente já vê só a dele). */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  company?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** true: só os N1; false: só os da equipe. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  n1?: boolean;

  /** A lixeira: só os excluídos (só o admin). */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  deleted?: boolean;
}
