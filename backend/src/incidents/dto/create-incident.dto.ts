import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentLevel, IncidentStatus } from '@prisma/client';
import { MAX_VARCHAR_LENGTH } from '../limits';

export class CreateIncidentDto {
  @IsOptional()
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
  environment!: string;

  @IsOptional()
  @IsEnum(IncidentLevel)
  priority?: IncidentLevel;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;
}
