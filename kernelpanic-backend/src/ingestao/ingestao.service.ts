import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { LeituraBrutaParaGravar, MedidaParaGravar, TelemetriaService } from './telemetria.service';

@Injectable()
export class IngestaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestaoService.name);

  // Buffers em memória: em vez de gravar uma leitura bruta e uma medida por
  // requisição, acumula os dois e grava em lotes grandes (ver flush()), para
  // o trigger de alertas — que roda uma vez por statement — processar muitas
  // leituras de uma vez.
  private loteBrutas: LeituraBrutaParaGravar[] = [];
  private loteMedidas: MedidaParaGravar[] = [];
  private timer?: NodeJS.Timeout;
  private readonly tamanhoLoteMaximo: number;
  private readonly intervaloFlushMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetria: TelemetriaService,
    config: ConfigService,
  ) {
    this.tamanhoLoteMaximo = Number(config.get('INGESTAO_LOTE_TAMANHO_MAX') ?? 5000);
    this.intervaloFlushMs = Number(config.get('INGESTAO_LOTE_INTERVALO_MS') ?? 2000);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.intervaloFlushMs);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  async ingerir(payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid: payload.vid },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        parametros: { select: { id: true, tipoParametro: { select: { nome: true } } } },
      },
    });

    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${payload.vid}"`);
    }

    const agora = Math.floor(Date.now() / 1000);
    const unixtimeDispositivo = payload.unixtime ?? agora;
    // Gerado aqui, não pelo banco: a gravação em si só acontece no próximo
    // flush do lote, mas o dispositivo já recebe o id na resposta (202 =
    // aceito para processamento, não "já commitado" — a semântica bate).
    const leituraBrutaId = randomUUID();

    this.loteBrutas.push({
      id: leituraBrutaId,
      vidEstacao: payload.vid,
      payload: payload.leituras,
      latitude: payload.latitude ?? estacao.latitude,
      longitude: payload.longitude ?? estacao.longitude,
      unixtimeDispositivo,
    });

    this.enfileirarMedidas(estacao, payload.leituras, unixtimeDispositivo);

    if (this.loteBrutas.length >= this.tamanhoLoteMaximo || this.loteMedidas.length >= this.tamanhoLoteMaximo) {
      void this.flush();
    }

    return new IngestaoRespostaDto(
      leituraBrutaId,
      estacao.id,
      Object.keys(payload.leituras).length,
      agora,
    );
  }

  private enfileirarMedidas(
    estacao: { id: string; parametros?: { id: string; tipoParametro: { nome: string } }[] },
    leituras: Record<string, number>,
    unixtime: number,
  ): void {
    // O nome do sensor no payload casa com o "nome" do tipoParametro
    // configurado para a estação (é o mesmo mapa que /parametros expõe para
    // o datalogger aprender). Leituras sem tipoParametro correspondente são
    // descartadas aqui — já foram preservadas intactas em leituras_brutas.
    const mapaParametros = new Map((estacao.parametros ?? []).map((p) => [p.tipoParametro.nome, p.id]));

    for (const [nome, valor] of Object.entries(leituras)) {
      const parametroId = mapaParametros.get(nome);
      if (!parametroId) continue;
      this.loteMedidas.push({ parametroId, estacaoId: estacao.id, valor, unixtime });
    }
  }

  /** Grava os dois lotes acumulados. Público para permitir flush manual (testes, shutdown). */
  async flush(): Promise<void> {
    if (this.loteBrutas.length === 0 && this.loteMedidas.length === 0) return;

    const brutas = this.loteBrutas;
    const medidas = this.loteMedidas;
    this.loteBrutas = [];
    this.loteMedidas = [];

    try {
      await Promise.all([
        this.telemetria.registrarLeiturasBrutas(brutas),
        this.telemetria.registrarMedidas(medidas),
      ]);
    } catch (erro) {
      this.logger.error(
        `Falha ao gravar lote (${brutas.length} leitura(s) bruta(s), ${medidas.length} medida(s))`,
        erro as Error,
      );
    }
  }

  async listarParametros(vid: string): Promise<EstacaoParametrosRespostaDto> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid },
      select: {
        id: true,
        vid: true,
        nome: true,
        parametros: {
          select: {
            tipoParametro: { select: { id: true, nome: true, unidade: true, fator: true, ganho: true } },
          },
        },
      },
    });

    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${vid}"`);
    }

    return new EstacaoParametrosRespostaDto(
      estacao.id,
      estacao.vid,
      estacao.nome,
      estacao.parametros.map(({ tipoParametro }) => ({
        tipoParametroId: tipoParametro.id,
        nome: tipoParametro.nome,
        unidade: tipoParametro.unidade,
        fator: tipoParametro.fator,
        ganho: tipoParametro.ganho,
      })),
    );
  }
}
