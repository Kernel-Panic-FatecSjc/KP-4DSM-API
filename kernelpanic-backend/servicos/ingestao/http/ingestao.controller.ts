import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { RequisicaoInvalida } from '../../../src/documentacao/respostas';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { IngestaoService } from '../ingestao.service';
import { GuardaChaveIngestao, HEADER_CHAVE_INGESTAO } from './guarda-chave-ingestao.guard';

// Alternativa ao MQTT para quem não fala com o broker (ex.: datalogger antigo).
// Mesmo destino: só leituras_brutas. Protegida pela chave da estação.
@ApiTags('ingestao')
@Controller('ingestao')
@UseGuards(GuardaChaveIngestao)
@ApiSecurity(HEADER_CHAVE_INGESTAO)
@ApiUnauthorizedResponse({ description: 'Chave de ingestão ausente ou que não confere com a da estação (também quando a estação não existe).' })
export class IngestaoController {
  constructor(private readonly ingestaoService: IngestaoService) {}

  // 202 também para estação inativa: o pacote é guardado, mas o tratamento não
  // gera medida nem alarme dele, e o corpo traz estacaoInativa: true.
  @Post('telemetria')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enviar telemetria de uma estação',
    description:
      'Alternativa HTTP ao MQTT. Guarda o pacote em leituras brutas; o tratamento gera as medidas depois. A estação é identificada pelo `vid` do corpo, que precisa ser o da chave do header `x-chave-estacao`.',
  })
  @ApiAcceptedResponse({ type: IngestaoRespostaDto, description: 'Pacote recebido e guardado (também quando a estação está inativa).' })
  @RequisicaoInvalida('Corpo inválido: leituras fora do formato, unixtime implausível ou coordenadas inválidas.')
  @ApiNotFoundResponse({ description: 'Nenhuma estação cadastrada para o vid.' })
  @ApiServiceUnavailableResponse({ description: 'Ingestão em encerramento; reenvie a leitura.' })
  async ingerir(@Body() payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    return this.ingestaoService.receber(payload);
  }

  @Get('estacoes/:vid/parametros')
  @ApiOperation({
    summary: 'Consultar os sensores configurados da estação',
    description: 'Devolve os sensores com fator e ganho, para o dispositivo saber os nomes que deve enviar em `leituras`.',
  })
  @ApiParam({ name: 'vid', description: 'Identificador (vid) da estação.', example: 'A4:CF:12:9B:77:01' })
  @ApiOkResponse({ type: EstacaoParametrosRespostaDto, description: 'Sensores da estação.' })
  @ApiNotFoundResponse({ description: 'Nenhuma estação cadastrada para o vid.' })
  async listarParametros(@Param('vid') vid: string): Promise<EstacaoParametrosRespostaDto> {
    return this.ingestaoService.listarParametros(vid);
  }
}
