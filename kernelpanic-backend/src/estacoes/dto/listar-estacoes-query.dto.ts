import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListarEstacoesQueryDto {
  @IsOptional()
  @IsString()
  regiao?: string;

  @IsOptional()
  @IsIn(['ATIVA', 'INATIVA'])
  status?: 'ATIVA' | 'INATIVA';

  @IsOptional()
  @IsUUID('4')
  tipoParametroId?: string;
}