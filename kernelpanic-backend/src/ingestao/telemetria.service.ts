import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LeituraBrutaParaGravar {
  id: string;
  vidEstacao: string;
  payload: Record<string, number>;
  latitude: number;
  longitude: number;
  unixtimeDispositivo: number;
}

export interface MedidaParaGravar {
  parametroId: string;
  estacaoId: string;
  valor: number;
  unixtime: number;
}

// Postgres aceita no máximo 65535 parâmetros por query; controla o tamanho
// do INSERT multi-linha pra nunca chegar perto disso (mesmo limite usado
// pelos scripts de teste-carga).
const PARAMS_POR_LEITURA_BRUTA = 6;
const MAX_LINHAS_POR_QUERY = 10_000;

@Injectable()
export class TelemetriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um lote de medidas num único INSERT multi-linha (createMany), para
   * que o trigger de avaliação de alertas — que roda por statement, não por
   * linha — seja disparado uma única vez para o lote inteiro.
   */
  async registrarMedidas(medidas: MedidaParaGravar[]): Promise<number> {
    if (medidas.length === 0) return 0;

    const { count } = await this.prisma.medida.createMany({
      data: medidas.map((medida) => ({ ...medida, unixtime: BigInt(medida.unixtime) })),
    });

    return count;
  }

  /**
   * Grava um lote de leituras brutas num único INSERT multi-linha. Raw SQL
   * (em vez de createMany) porque "localizacao" é geometry do PostGIS —
   * tipo que o Prisma marca como Unsupported e não sabe gravar sozinho. O id
   * já vem pronto de quem chamou (gerado na hora da requisição), porque a
   * gravação em si só acontece no próximo flush do lote.
   */
  async registrarLeiturasBrutas(leituras: LeituraBrutaParaGravar[]): Promise<number> {
    let total = 0;
    for (let i = 0; i < leituras.length; i += MAX_LINHAS_POR_QUERY) {
      total += await this.inserirSubLoteBrutas(leituras.slice(i, i + MAX_LINHAS_POR_QUERY));
    }
    return total;
  }

  private async inserirSubLoteBrutas(leituras: LeituraBrutaParaGravar[]): Promise<number> {
    if (leituras.length === 0) return 0;

    const valores: unknown[] = [];
    const linhas = leituras.map((leitura, indice) => {
      const base = indice * PARAMS_POR_LEITURA_BRUTA;
      valores.push(
        leitura.id,
        leitura.vidEstacao,
        JSON.stringify(leitura.payload),
        leitura.longitude,
        leitura.latitude,
        BigInt(leitura.unixtimeDispositivo),
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, ST_SetSRID(ST_MakePoint($${base + 4}, $${base + 5}), 4326), $${base + 6})`;
    });

    return this.prisma.$executeRawUnsafe(
      `INSERT INTO leituras_brutas (id, "vidEstacao", payload, localizacao, "unixtimeDispositivo")
       VALUES ${linhas.join(', ')}`,
      ...valores,
    );
  }
}
