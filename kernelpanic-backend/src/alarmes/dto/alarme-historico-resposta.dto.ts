import { ApiProperty } from '@nestjs/swagger';
import {
  OperadorAlerta,
  SeveridadeAlerta,
  StatusAlarme,
  type Alarme,
  type Alerta,
  type Estacao,
  type Medida,
  type Parametro,
  type TipoParametro,
} from '../../generated/prisma/client';
import { EstacaoResumoDto } from '../../alertas/dto/alerta-resposta.dto';

interface Responsavel {
  id: string;
  nome: string;
}

type AlarmeComRelacoes = Alarme & {
  medida: Medida;
  reconhecidoPor?: Responsavel | null;
  resolvidoPor?: Responsavel | null;
  alerta: Alerta & {
    parametro: Parametro & {
      estacao: Estacao;
      tipoParametro: TipoParametro;
    };
  };
};

export class ParametroDoAlarmeDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111', description: 'Id do tipo de parâmetro (sensor).' })
  id!: string;

  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;
}

export class AlarmeHistoricoRespostaDto {
  @ApiProperty({ example: '9d6d2d7e-1c3a-4e8e-8f10-2b8a4a0c7e55' })
  id: string;
  @ApiProperty({ example: '2026-11-08T14:32:10.000Z', description: 'Momento do disparo (ISO 8601, UTC).' })
  disparadoEm: Date;
  @ApiProperty({ enum: StatusAlarme, description: 'Situação do alarme: ABERTO, RECONHECIDO ou RESOLVIDO.' })
  status: string;
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Licitação do alarme.' })
  licitacaoId: string;
  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: string;
  @ApiProperty({ enum: OperadorAlerta, description: 'Condição do alerta que disparou.' })
  operador: string;
  @ApiProperty({ example: 35, description: 'Limite configurado no alerta, na unidade do parâmetro.' })
  valorLimite: number;
  @ApiProperty({ example: 38.4, description: 'Valor medido que disparou o alarme, na unidade do parâmetro.' })
  valorMedido: number;
  @ApiProperty({ type: EstacaoResumoDto })
  estacao: { id: string; nome: string };
  @ApiProperty({ type: ParametroDoAlarmeDto })
  parametro: { id: string; nome: string; unidade: string };
  /** Quem reconheceu e quando; nulo enquanto aberto (ou tratado antes deste registro existir). */
  reconhecimento: { em: Date; por: Responsavel | null } | null;
  resolucao: { em: Date; por: Responsavel | null } | null;
  observacao: string | null;

  constructor(alarme: AlarmeComRelacoes) {
    this.id = alarme.id;
    this.disparadoEm = alarme.disparadoEm;
    this.status = alarme.status;
    this.licitacaoId = alarme.alerta.licitacaoId;
    this.severidade = alarme.alerta.severidade;
    this.operador = alarme.alerta.operador;
    this.valorLimite = alarme.alerta.valorLimite;
    this.valorMedido = alarme.medida.valor;
    this.estacao = { id: alarme.alerta.parametro.estacao.id, nome: alarme.alerta.parametro.estacao.nome };
    this.parametro = {
      id: alarme.alerta.parametro.tipoParametro.id,
      nome: alarme.alerta.parametro.tipoParametro.nome,
      unidade: alarme.alerta.parametro.tipoParametro.unidade,
    };
    this.reconhecimento = alarme.reconhecidoEm
      ? { em: alarme.reconhecidoEm, por: alarme.reconhecidoPor ?? null }
      : null;
    this.resolucao = alarme.resolvidoEm ? { em: alarme.resolvidoEm, por: alarme.resolvidoPor ?? null } : null;
    this.observacao = alarme.observacao ?? null;
  }
}
