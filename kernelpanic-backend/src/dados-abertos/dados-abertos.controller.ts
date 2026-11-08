import { Controller, Get, Headers, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import { Publico } from '../autenticacao/publico.decorator';
import { enviarCsv } from '../exportacao/csv';
import { DadosAbertosService } from './dados-abertos.service';
import { MedidasAbertasQueryDto } from './dto/medidas-abertas-query.dto';
import { MedidasAbertasRespostaDto } from './dto/medidas-abertas-resposta.dto';
import { resolverFormato } from './formato';

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
  @ApiOkResponse({
    type: MedidasAbertasRespostaDto,
    description: 'JSON; com `formato=csv` (ou Accept: text/csv) a resposta é um arquivo CSV com as mesmas linhas.',
  })
  @ApiBadRequestResponse({ description: 'Parâmetro inválido, formato não suportado ou período acima do limite.' })
  async medidas(
    @Query() query: MedidasAbertasQueryDto,
    @Headers('accept') accept: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const resultado = await this.dadosAbertosService.medidas(query);

    if (resolverFormato(query.formato, accept) === 'json') {
      resposta.json(resultado);
      return;
    }
    async function* lotes() {
      yield resultado.dados.map((linha) => CABECALHO_MEDIDAS_CSV.map((campo) => linha[campo]));
    }
    await enviarCsv(resposta, 'medidas.csv', [...CABECALHO_MEDIDAS_CSV], lotes());
  }
}
