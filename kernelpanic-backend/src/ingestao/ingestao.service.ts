import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { TelemetriaService } from './telemetria.service';

@Injectable()
export class IngestaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetria: TelemetriaService,
  ) {}

  async ingerir(payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid: payload.vid },
      select: { id: true, latitude: true, longitude: true },
    });

    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${payload.vid}"`);
    }

    const agora = Math.floor(Date.now() / 1000);

    const leituraBrutaId = await this.telemetria.registrarLeituraBruta({
      vidEstacao: payload.vid,
      payload: payload.leituras,
      latitude: payload.latitude ?? estacao.latitude,
      longitude: payload.longitude ?? estacao.longitude,
      unixtimeDispositivo: payload.unixtime ?? agora,
    });

    return new IngestaoRespostaDto(
      leituraBrutaId,
      estacao.id,
      Object.keys(payload.leituras).length,
      agora,
    );
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
