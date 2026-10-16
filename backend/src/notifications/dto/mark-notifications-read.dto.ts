import { IsInt, IsOptional, Min } from 'class-validator';

export class MarkNotificationsReadDto {
  /** Só os avisos deste chamado; sem ele, todos. */
  @IsOptional()
  @IsInt()
  @Min(1)
  incidentId?: number;
}
