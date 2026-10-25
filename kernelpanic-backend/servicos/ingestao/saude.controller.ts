import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
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
@Controller('saude')
export class SaudeIngestaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
    private readonly assinante: AssinanteMqttService,
  ) {}

  @Get()
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
