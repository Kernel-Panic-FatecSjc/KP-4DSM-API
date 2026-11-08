import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { OperadorAlerta, SeveridadeAlerta } from '../../generated/prisma/client';

export class CriarAlertaDto {
  @ApiProperty({ enum: OperadorAlerta, example: OperadorAlerta.MAIOR_QUE, description: 'Condição comparada com o valor medido.' })
  @IsEnum(OperadorAlerta)
  operador!: OperadorAlerta;

  @ApiProperty({ example: 35, description: 'Valor limite, na unidade do parâmetro monitorado.' })
  @IsNumber()
  valorLimite!: number;

  @ApiProperty({ enum: SeveridadeAlerta, example: SeveridadeAlerta.ALERTA, description: 'Gravidade do alarme gerado.' })
  @IsEnum(SeveridadeAlerta)
  severidade!: SeveridadeAlerta;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222', description: 'Parâmetro (sensor de uma estação) monitorado.' })
  @IsUUID('4')
  parametroId!: string;
}
