import { IsEnum } from 'class-validator';
import { StatusAlarme } from '../../generated/prisma/client';

export class AtualizarStatusAlarmeDto {
  @IsEnum(StatusAlarme)
  status!: StatusAlarme;
}
