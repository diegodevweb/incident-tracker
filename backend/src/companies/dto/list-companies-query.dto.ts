import { Type } from 'class-transformer';
import {
  IsIn,
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

export class ListCompaniesQueryDto {
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

  /** Busca por nome ou CNPJ (com ou sem pontuação). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_VARCHAR_LENGTH)
  q?: string;

  /** Sem filtro, lista ativas e desativadas. */
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
