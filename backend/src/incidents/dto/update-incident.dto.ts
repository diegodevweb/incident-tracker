import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IncidentLevel, IncidentStatus } from '@prisma/client';
import { ToBoolean } from '../../common/to-boolean';
import { MAX_LONG_TEXT_LENGTH } from '../limits';

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  /** Só o admin muda; o service recusa a do cliente. */
  @IsOptional()
  @IsEnum(IncidentLevel)
  priority?: IncidentLevel;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  correctiveActions?: string;

  /** Só o admin classifica; o service recusa a do cliente. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  n1?: boolean;
}
