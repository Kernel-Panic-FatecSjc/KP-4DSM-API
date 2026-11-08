import { Controller, Get, Headers, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import { Publico } from '../autenticacao/publico.decorator';
import { DadosAbertosService } from './dados-abertos.service';
import { AlarmesAbertosQueryDto } from './dto/alarmes-abertos-query.dto';
import { AlarmesAbertosRespostaDto } from './dto/alarmes-abertos-resposta.dto';
import { EstacoesAbertasQueryDto } from './dto/estacoes-abertas-query.dto';
import { EstacoesAbertasRespostaDto } from './dto/estacoes-abertas-resposta.dto';
import { MedidasAbertasQueryDto } from './dto/medidas-abertas-query.dto';
import { MedidasAbertasRespostaDto } from './dto/medidas-abertas-resposta.dto';
import { resolverFormato } from './formato';
import { responder } from './resposta';

export const CABECALHO_MEDIDAS_CSV = [
  'estacaoId',
  'estacaoNome',
  'parametro',
  'unidade',
  'inicio',
  'granularidade',
  'agregacao',
  'valor',
  'quantidadeLeituras',
] as const;

export const CABECALHO_ESTACOES_CSV = ['id', 'nome', 'latitude', 'longitude', 'statusOperacional', 'sensores'] as const;

export const CABECALHO_ALARMES_CSV = [
  'id',
  'disparadoEm',
  'estacaoId',
  'estacaoNome',
  'parametro',
  'operador',
  'valorLimite',
  'valorMedido',
  'severidade',
  'status',
] as const;

const DESCRICAO_FORMATO =
  'JSON; com `formato=csv` (ou Accept: text/csv) a resposta é um arquivo CSV com as mesmas linhas.';

/** Dados abertos (e-PING): sem login, só leitura, sob o limite de requisições. Padrão em docs/padrao-e-ping.md. */
@ApiTags('dados-abertos')
@Controller('v1/dados-abertos')
@UseGuards(GuardaJwt, GuardaPerfil)
@Publico()
@ApiTooManyRequestsResponse({ description: 'Limite de requisições por IP excedido.' })
export class DadosAbertosController {
  constructor(private readonly dadosAbertosService: DadosAbertosService) {}

  @Get('medidas')
  @ApiOperation({
    summary: 'Medições meteorológicas consolidadas (JSON ou CSV)',
    description:
      'Agrega no banco por hora ou dia (UTC), com SOMA ou MEDIA conforme o parâmetro. Pública, sem login. A mesma consulta devolve os mesmos dados em JSON e CSV.',
  })
  @ApiProduces('application/json', 'text/csv')
  @ApiOkResponse({ type: MedidasAbertasRespostaDto, description: DESCRICAO_FORMATO })
  @ApiBadRequestResponse({ description: 'Parâmetro inválido, formato não suportado ou período acima do limite.' })
  async medidas(
    @Query() query: MedidasAbertasQueryDto,
    @Headers('accept') accept: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const resultado = await this.dadosAbertosService.medidas(query);
    await responder(
      resposta,
      resolverFormato(query.formato, accept),
      resultado,
      'medidas.csv',
      [...CABECALHO_MEDIDAS_CSV],
      resultado.dados.map((linha) => CABECALHO_MEDIDAS_CSV.map((campo) => linha[campo])),
    );
  }

  @Get('estacoes')
  @ApiOperation({
    summary: 'Catálogo de estações meteorológicas (JSON ou CSV)',
    description:
      'Id, nome, coordenadas (WGS84), status operacional e os sensores com suas unidades. Não traz dados de usuário. No CSV os sensores ficam em uma coluna, no formato `nome (unidade)` separados por ` | `.',
  })
  @ApiProduces('application/json', 'text/csv')
  @ApiOkResponse({ type: EstacoesAbertasRespostaDto, description: DESCRICAO_FORMATO })
  @ApiBadRequestResponse({ description: 'Parâmetro inválido ou formato não suportado.' })
  async estacoes(
    @Query() query: EstacoesAbertasQueryDto,
    @Headers('accept') accept: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const resultado = await this.dadosAbertosService.estacoes(query);
    await responder(
      resposta,
      resolverFormato(query.formato, accept),
      resultado,
      'estacoes.csv',
      [...CABECALHO_ESTACOES_CSV],
      resultado.dados.map((e) => [
        e.id,
        e.nome,
        e.latitude,
        e.longitude,
        e.statusOperacional,
        e.sensores.map((s) => `${s.nome} (${s.unidade})`).join(' | '),
      ]),
    );
  }

  @Get('alarmes')
  @ApiOperation({
    summary: 'Histórico de alarmes (JSON ou CSV)',
    description:
      'Alarmes disparados no período (UTC): estação, parâmetro, condição do alerta, valor limite, valor medido, severidade e status. Não traz dados de usuário.',
  })
  @ApiProduces('application/json', 'text/csv')
  @ApiOkResponse({ type: AlarmesAbertosRespostaDto, description: DESCRICAO_FORMATO })
  @ApiBadRequestResponse({ description: 'Parâmetro inválido, formato não suportado ou período acima do limite.' })
  async alarmes(
    @Query() query: AlarmesAbertosQueryDto,
    @Headers('accept') accept: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const resultado = await this.dadosAbertosService.alarmes(query);
    await responder(
      resposta,
      resolverFormato(query.formato, accept),
      resultado,
      'alarmes.csv',
      [...CABECALHO_ALARMES_CSV],
      resultado.dados.map((linha) => CABECALHO_ALARMES_CSV.map((campo) => linha[campo])),
    );
  }
}
