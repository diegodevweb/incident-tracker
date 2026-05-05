import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePreventiveActionDto {
  @IsString()
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  incidentId?: number;
}
