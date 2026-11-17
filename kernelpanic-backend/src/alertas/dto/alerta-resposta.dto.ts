import { ApiProperty } from '@nestjs/swagger';
import {
  OperadorAlerta,
  SeveridadeAlerta,
  type Alerta,
  type Estacao,
  type Parametro,
  type TipoParametro,
} from '../../generated/prisma/client';

type AlertaComRelacoes = Alerta & {
  parametro: Parametro & {
    estacao: Estacao;
    tipoParametro: TipoParametro;
  };
};

export class EstacaoResumoDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome!: string;
}

export class ParametroResumoDto {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222', description: 'Id do parâmetro (sensor da estação).' })
  id!: string;

  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;
}

export class AlertaRespostaDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id: string;
  @ApiProperty({ enum: OperadorAlerta, description: 'Condição comparada com o valor medido.' })
  operador: string;
  @ApiProperty({ example: 35, description: 'Valor limite, na unidade do parâmetro.' })
  valorLimite: number;
  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: string;
  @ApiProperty({ example: true, description: 'false quando o alerta foi inativado.' })
  ativo: boolean;
  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Data de criação (ISO 8601, UTC).' })
  criadoEm: Date;
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Licitação do alerta (a da estação).' })
  licitacaoId: string;
  @ApiProperty({ type: EstacaoResumoDto })
  estacao: { id: string; nome: string };
  @ApiProperty({ type: ParametroResumoDto })
  parametro: { id: string; nome: string; unidade: string };

  constructor(alerta: AlertaComRelacoes) {
    this.id = alerta.id;
    this.operador = alerta.operador;
    this.valorLimite = alerta.valorLimite;
    this.severidade = alerta.severidade;
    this.ativo = alerta.ativo;
    this.criadoEm = alerta.criadoEm;
    this.licitacaoId = alerta.licitacaoId;
    this.estacao = { id: alerta.parametro.estacao.id, nome: alerta.parametro.estacao.nome };
    this.parametro = {
      id: alerta.parametro.id,
      nome: alerta.parametro.tipoParametro.nome,
      unidade: alerta.parametro.tipoParametro.unidade,
    };
  }
}
