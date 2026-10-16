import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestaoService } from '../ingestao/ingestao.service';

@Injectable()
export class SaudeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
  ) {}

  async verificar(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return this.ingestao.obterEstadoFlush() === 'ok';
    } catch {
      return false;
    }
  }
}
