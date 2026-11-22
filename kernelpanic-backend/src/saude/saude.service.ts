import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export type EstadoComponente = 'ok' | 'falha';

// A ingestão saiu do backend (serviços próprios, com /saude próprio): aqui
// só o banco importa.
export interface EstadoSaude {
  banco: EstadoComponente;
  versao: string;
}

export const VERSAO_DESENVOLVIMENTO = 'desenvolvimento';

// O pacote do deploy traz o arquivo VERSAO na raiz (.github/scripts/empacotar.sh)
// e a API roda de <raiz>/kernelpanic-backend. Com isso o /saude mostra qual commit
// está no ar em cada ambiente (pré-release e produção) e o smoke pós-deploy
// confirma que a versão nova subiu. Fora do pacote (dev e testes) não há arquivo.
export function lerVersao(arquivo = join(process.cwd(), '..', 'VERSAO')): string {
  try {
    const linha = readFileSync(arquivo, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('commit='));
    const commit = linha?.slice('commit='.length).trim() ?? '';
    return /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : VERSAO_DESENVOLVIMENTO;
  } catch {
    return VERSAO_DESENVOLVIMENTO;
  }
}

// Banco travado não pode deixar o health check pendurado: sem resposta, o
// monitoramento não distingue "caiu" de "lento" e o probe nunca vê o 503.
export const TIMEOUT_BANCO_MS = 3000;

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);
  private readonly versao = lerVersao();

  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<EstadoSaude> {
    return { banco: await this.verificarBanco(), versao: this.versao };
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
