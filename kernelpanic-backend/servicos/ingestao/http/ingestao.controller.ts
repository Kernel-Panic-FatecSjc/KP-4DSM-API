import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { IngestaoService } from '../ingestao.service';
import { GuardaChaveIngestao } from './guarda-chave-ingestao.guard';

// Alternativa ao MQTT para quem não fala com o broker (ex.: datalogger antigo).
// Mesmo destino: só leituras_brutas. Protegida pela chave da estação.
@Controller('ingestao')
@UseGuards(GuardaChaveIngestao)
export class IngestaoController {
  constructor(private readonly ingestaoService: IngestaoService) {}

  // 202 também para estação inativa: o pacote é guardado, mas o tratamento não
  // gera medida nem alarme dele, e o corpo traz estacaoInativa: true.
  @Post('telemetria')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingerir(@Body() payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    return this.ingestaoService.receber(payload);
  }

  @Get('estacoes/:vid/parametros')
  async listarParametros(@Param('vid') vid: string): Promise<EstacaoParametrosRespostaDto> {
    return this.ingestaoService.listarParametros(vid);
  }
}
