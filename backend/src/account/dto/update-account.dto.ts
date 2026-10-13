import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';

// Só o nome: o e-mail é o login, e quem muda o de um cliente é o admin.
export class UpdateAccountDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name!: string;
}
