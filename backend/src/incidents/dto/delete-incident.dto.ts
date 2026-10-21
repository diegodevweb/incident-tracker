import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_DELETION_REASON_LENGTH } from '../limits';

export class DeleteIncidentDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da exclusão' })
  @MaxLength(MAX_DELETION_REASON_LENGTH)
  reason!: string;
}
