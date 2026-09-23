import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { OperadorAlerta, SeveridadeAlerta } from '../../generated/prisma/client';

export class CriarAlertaDto {
  @IsEnum(OperadorAlerta)
  operador!: OperadorAlerta;

  @IsNumber()
  valorLimite!: number;

  @IsEnum(SeveridadeAlerta)
  severidade!: SeveridadeAlerta;

  @IsUUID('4')
  parametroId!: string;
}