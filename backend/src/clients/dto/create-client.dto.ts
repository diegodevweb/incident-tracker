import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';

// Sem senha: o servidor gera uma temporária e o cliente troca no 1º acesso.
export class CreateClientDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name!: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(MAX_VARCHAR_LENGTH)
  email!: string;
}
