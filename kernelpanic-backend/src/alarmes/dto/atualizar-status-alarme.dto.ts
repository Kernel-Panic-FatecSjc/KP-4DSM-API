import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatusAlarme } from '../../generated/prisma/client';

export const TAMANHO_MAXIMO_OBSERVACAO = 1000;

export class AtualizarStatusAlarmeDto {
  @ApiProperty({
    enum: StatusAlarme,
    example: StatusAlarme.RECONHECIDO,
    description: 'Novo status. Só avança: ABERTO, depois RECONHECIDO, depois RESOLVIDO.',
  })
  @IsEnum(StatusAlarme)
  status!: StatusAlarme;

  /** O que foi feito (ex.: "equipe enviada ao local"); vai para o relatório de incidentes. */
  @IsOptional()
  @IsString()
  @MaxLength(TAMANHO_MAXIMO_OBSERVACAO)
  observacao?: string;
}
