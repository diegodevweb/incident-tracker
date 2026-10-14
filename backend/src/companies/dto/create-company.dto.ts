import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';
import { IsCnpj, NormalizeCnpj } from '../cnpj';

export class CreateCompanyDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name!: string;

  /** Opcional; aceita com ou sem pontuação, numérico ou alfanumérico. */
  @IsOptional()
  @NormalizeCnpj()
  @IsCnpj()
  cnpj?: string | null;
}
