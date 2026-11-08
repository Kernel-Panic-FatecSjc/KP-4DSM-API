import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { OperadorAlerta, SeveridadeAlerta } from '../../generated/prisma/client';

export class AtualizarAlertaDto {
  @ApiPropertyOptional({ enum: OperadorAlerta, description: 'Nova condição.' })
  @IsOptional()
  @IsEnum(OperadorAlerta)
  operador?: OperadorAlerta;

  @ApiPropertyOptional({ example: 35, description: 'Novo valor limite, na unidade do parâmetro.' })
  @IsOptional()
  @IsNumber()
  valorLimite?: number;

  @ApiPropertyOptional({ enum: SeveridadeAlerta, description: 'Nova severidade.' })
  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({ example: true, description: 'Ativa ou desativa o alerta.' })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222', description: 'Novo parâmetro monitorado, da licitação do alerta.' })
  @IsOptional()
  @IsUUID('4')
  parametroId?: string;
}
