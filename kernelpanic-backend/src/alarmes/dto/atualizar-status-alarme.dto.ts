import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusAlarme } from '../../generated/prisma/client';

export class AtualizarStatusAlarmeDto {
  @ApiProperty({
    enum: StatusAlarme,
    example: StatusAlarme.RECONHECIDO,
    description: 'Novo status. Só avança: ABERTO, depois RECONHECIDO, depois RESOLVIDO.',
  })
  @IsEnum(StatusAlarme)
  status!: StatusAlarme;
}
