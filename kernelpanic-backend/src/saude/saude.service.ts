import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async bancoDisponivel(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (erro) {
      this.logger.error(`Banco indisponível: ${(erro as Error).message}`);
      return false;
    }
  }

  // Tag da imagem em execução (sha-<commit>), injetada pelo docker-compose do deploy.
  versao(): string {
    return process.env.APP_VERSION ?? 'desenvolvimento';
  }
}
