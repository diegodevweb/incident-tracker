import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MAX_LONG_TEXT_LENGTH } from '../limits';

export class CreatePreventiveActionDto {
  @IsString()
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  incidentId?: number;
}
