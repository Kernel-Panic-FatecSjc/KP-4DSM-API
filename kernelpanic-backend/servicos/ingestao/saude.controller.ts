import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SaudeIngestaoRespostaDto } from './dto/saude-ingestao-resposta.dto';
import { IngestaoService } from './ingestao.service';
import { AssinanteMqttService, type EstadoMqtt } from './mqtt/assinante-mqtt.service';

const TIMEOUT_BANCO_MS = 3000;

export interface EstadoSaudeIngestao {
  banco: 'ok' | 'falha';
  lote: 'ok' | 'falha';
  mqtt: EstadoMqtt;
  mensagensRecusadas: number;
}

/** Health check do serviço de ingestão: banco, lote pendente e conexão com o broker. */
@ApiTags('saude')
@Controller('saude')
export class SaudeIngestaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
    private readonly assinante: AssinanteMqttService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Verificar a saúde do serviço de ingestão', description: 'Health check: banco, lote de leituras pendente e conexão com o broker MQTT.' })
  @ApiOkResponse({ type: SaudeIngestaoRespostaDto, description: 'Serviço saudável.' })
  @ApiServiceUnavailableResponse({ type: SaudeIngestaoRespostaDto, description: 'Algum componente falhou; o corpo aponta qual.' })
  async verificar(): Promise<EstadoSaudeIngestao> {
    const estado: EstadoSaudeIngestao = {
      banco: await this.verificarBanco(),
      lote: this.ingestao.obterEstadoFlush(),
      mqtt: this.assinante.estado(),
      mensagensRecusadas: this.assinante.mensagensRecusadas,
    };
    if (estado.banco !== 'ok' || estado.lote !== 'ok' || estado.mqtt === 'falha') {
      throw new ServiceUnavailableException(estado);
    }
    return estado;
  }

  private async verificarBanco(): Promise<'ok' | 'falha'> {
    let temporizador: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, rejeitar) => {
          temporizador = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_BANCO_MS);
        }),
      ]);
      return 'ok';
    } catch {
      return 'falha';
    } finally {
      clearTimeout(temporizador);
    }
  }
}
