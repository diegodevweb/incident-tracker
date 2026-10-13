import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_VARCHAR_LENGTH } from '../../incidents/limits';

export class CreateWebhookKeyDto {
  /** Para identificar a integração na listagem, ex.: "ERP produção". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_VARCHAR_LENGTH)
  name!: string;
}
