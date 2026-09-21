import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { GuardaChaveIngestao } from './guarda-chave-ingestao.guard';
import { IngestaoService } from './ingestao.service';

@Controller('ingestao')
@UseGuards(GuardaChaveIngestao)
export class IngestaoController {
  constructor(private readonly ingestaoService: IngestaoService) {}

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
