import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';
import { IsCnpj, NormalizeCnpj } from '../cnpj';

export class UpdateCompanyDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name?: string;

  /** null ou "" tira o CNPJ; ausente não muda. */
  @IsOptional()
  @NormalizeCnpj()
  @IsCnpj()
  cnpj?: string | null;
}
