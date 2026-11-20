import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StatusAlarme } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ARQUIVO = 'alertas.json';
// Alarme ainda não resolvido e disparado nesta janela entra na página pública.
const JANELA_MS = 24 * 60 * 60 * 1000;
const LIMITE_ALERTAS = 200;
// Tira da página o alarme que foi resolvido (ninguém avisa o worker disso).
const REVISAO_MS = 60 * 1000;

export interface AlertaPublico {
  id: string;
  severidade: string;
  estacao: string;
  parametro: string;
  unidade: string;
  valor: number;
  disparadoEm: string;
}

/**
 * Grava em disco o JSON que a página estática de alerta público lê. O Caddy
 * serve o arquivo direto, então 100 mil leitores não chegam na API nem no banco:
 * o custo aqui é uma consulta por alarme novo (e uma por minuto), não por leitor.
 * Só vão campos já públicos: sem usuário, licitação ou observação.
 */
@Injectable()
export class AlertaPublicoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertaPublicoService.name);
  private readonly pasta: string | undefined;
  private timer: NodeJS.Timeout | null = null;
  private publicando = false;
  private repetir = false;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.pasta = configService.get<string>('ALERTA_PUBLICO_DIR') || undefined;
  }

  async onModuleInit(): Promise<void> {
    if (!this.pasta) return;
    await this.publicar();
    this.timer = setInterval(() => void this.publicar(), REVISAO_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Reescreve o arquivo se a lista de alertas mudou. Nunca lança. */
  async publicar(): Promise<void> {
    if (!this.pasta) return;
    // Pedidos que chegam durante uma publicação viram uma publicação extra só.
    if (this.publicando) {
      this.repetir = true;
      return;
    }

    this.publicando = true;
    try {
      do {
        this.repetir = false;
        await this.gravar(this.pasta, await this.buscar());
      } while (this.repetir);
    } catch (erro) {
      this.logger.error('Falha ao publicar o alerta público', erro);
    } finally {
      this.publicando = false;
    }
  }

  private async buscar(): Promise<AlertaPublico[]> {
    const alarmes = await this.prisma.alarme.findMany({
      where: {
        status: { not: StatusAlarme.RESOLVIDO },
        disparadoEm: { gte: new Date(Date.now() - JANELA_MS) },
      },
      orderBy: { disparadoEm: 'desc' },
      take: LIMITE_ALERTAS,
      select: {
        id: true,
        disparadoEm: true,
        medida: { select: { valor: true } },
        alerta: {
          select: {
            severidade: true,
            parametro: { select: { estacao: { select: { nome: true } }, tipoParametro: { select: { nome: true, unidade: true } } } },
          },
        },
      },
    });

    return alarmes.map((alarme) => ({
      id: alarme.id,
      severidade: alarme.alerta.severidade,
      estacao: alarme.alerta.parametro.estacao.nome,
      parametro: alarme.alerta.parametro.tipoParametro.nome,
      unidade: alarme.alerta.parametro.tipoParametro.unidade,
      valor: alarme.medida.valor,
      disparadoEm: alarme.disparadoEm.toISOString(),
    }));
  }

  private async gravar(pasta: string, alertas: AlertaPublico[]): Promise<void> {
    const destino = join(pasta, ARQUIVO);
    const anterior = await readFile(destino, 'utf8').then(
      (texto) => (JSON.parse(texto) as { alertas: AlertaPublico[] }).alertas,
      () => null,
    );
    // Sem mudança, o arquivo (e o cache de quem o serve) fica como está.
    if (anterior && JSON.stringify(anterior) === JSON.stringify(alertas)) return;

    await mkdir(pasta, { recursive: true });
    // Escreve ao lado e renomeia: o leitor nunca pega um JSON pela metade.
    const temporario = `${destino}.tmp`;
    await writeFile(temporario, JSON.stringify({ atualizadoEm: new Date().toISOString(), alertas }));
    await rename(temporario, destino);
  }
}
