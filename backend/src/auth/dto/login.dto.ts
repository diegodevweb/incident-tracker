import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Sem tamanho mínimo: a política de senha vale onde a senha é definida
// (password-policy.ts), não no login, que precisa aceitar contas já existentes.
export class LoginDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
