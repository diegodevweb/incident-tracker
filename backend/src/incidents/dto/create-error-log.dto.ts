import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IncidentLevel } from '@prisma/client';
import { MAX_VARCHAR_LENGTH } from '../limits';

// Sem clientId, source e status: o cliente sai da chave do webhook e o
// chamado sempre nasce aberto e com origem WEBHOOK. Mandar esses campos dá 400.
export class CreateErrorLogDto {
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
  @IsEnum(IncidentLevel)
  priority?: IncidentLevel;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
