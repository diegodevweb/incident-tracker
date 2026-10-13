import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/trim';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';

export class UpdateClientDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name?: string;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(MAX_VARCHAR_LENGTH)
  email?: string;
}
