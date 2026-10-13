import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// A política (password-policy.ts) é aplicada no service, que conhece o e-mail.
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}
