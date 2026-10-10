import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IncidentStatus } from '@prisma/client';
import { MAX_LONG_TEXT_LENGTH } from '../limits';

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  correctiveActions?: string;
}
