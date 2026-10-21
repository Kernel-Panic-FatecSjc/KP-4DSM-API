import { Injectable, Logger } from '@nestjs/common';
import { IngestaoService } from '../ingestao/ingestao.service';
import { PrismaService } from '../prisma/prisma.service';

export type EstadoComponente = 'ok' | 'falha';

export interface EstadoSaude {
  banco: EstadoComponente;
  ingestao: EstadoComponente;
}

// Banco travado não pode deixar o health check pendurado: sem resposta, o
// monitoramento não distingue "caiu" de "lento" e o probe nunca vê o 503.
export const TIMEOUT_BANCO_MS = 3000;

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
  ) {}

  async verificar(): Promise<EstadoSaude> {
    return { banco: await this.verificarBanco(), ingestao: this.ingestao.obterEstadoFlush() };
  }

  private async verificarBanco(): Promise<EstadoComponente> {
    let temporizador: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, rejeitar) => {
          temporizador = setTimeout(
            () => rejeitar(new Error(`Banco sem resposta em ${TIMEOUT_BANCO_MS} ms`)),
            TIMEOUT_BANCO_MS,
          );
        }),
      ]);
      return 'ok';
    } catch (erro) {
      this.logger.error('Falha na verificação de saúde do banco de dados', erro as Error);
      return 'falha';
    } finally {
      clearTimeout(temporizador);
    }
  }
}
