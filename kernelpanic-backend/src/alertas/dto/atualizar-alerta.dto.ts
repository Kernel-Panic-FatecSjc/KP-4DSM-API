import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { OperadorAlerta, SeveridadeAlerta } from '../../generated/prisma/client';

export class AtualizarAlertaDto {
  @IsOptional()
  @IsEnum(OperadorAlerta)
  operador?: OperadorAlerta;

  @IsOptional()
  @IsNumber()
  valorLimite?: number;

  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsUUID('4')
  parametroId?: string;
}