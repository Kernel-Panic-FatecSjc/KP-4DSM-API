import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestaoService } from '../ingestao/ingestao.service';

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
  ) {}

  async verificar(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return this.ingestao.obterEstadoFlush() === 'ok';
    } catch (erro) {
      this.logger.error('Falha na verificação de saúde do banco de dados', erro as Error);
      return false;
    }
  }
}
