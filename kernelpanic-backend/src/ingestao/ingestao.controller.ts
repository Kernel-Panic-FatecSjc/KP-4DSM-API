import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { GuardaChaveIngestao } from './guarda-chave-ingestao.guard';
import { IngestaoService } from './ingestao.service';

// As estações enviam leituras em alta frequência (e o teste de carga simula
// centenas delas de um IP só); já são protegidas pela chave de ingestão.
@Controller('ingestao')
@SkipThrottle()
@UseGuards(GuardaChaveIngestao)
export class IngestaoController {
  constructor(private readonly ingestaoService: IngestaoService) {}

  // 202 também para estação inativa: o pacote é guardado, mas não gera medida
  // nem alarme, e o corpo traz estacaoInativa: true (ver README, "Ingestão: estação inativa").
  // TODO(SCRUM-45): documentar no Swagger quando o OpenAPI for configurado: o 202 com
  // estacaoInativa (true quando o pacote foi guardado sem gerar medida) e o 401/404.
  @Post('telemetria')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingerir(@Body() payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    return this.ingestaoService.ingerir(payload);
  }

  @Get('estacoes/:vid/parametros')
  async listarParametros(@Param('vid') vid: string): Promise<EstacaoParametrosRespostaDto> {
    return this.ingestaoService.listarParametros(vid);
  }
}
