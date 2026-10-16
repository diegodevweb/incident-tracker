import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim';
import { MAX_LONG_TEXT_LENGTH } from '../limits';

export class CreateIncidentCommentDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  message!: string;
}
