import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';
import { MAX_PAGE_SIZE } from '../../incidents/pagination';

export class ListClientsQueryDto {
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

  /** Busca por nome ou e-mail. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  q?: string;
}
