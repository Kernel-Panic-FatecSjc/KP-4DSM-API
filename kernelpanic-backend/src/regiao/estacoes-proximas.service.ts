import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RAIO_REGIAO_KM, type Coordenadas } from './regiao';

@Injectable()
export class EstacoesProximasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ids das estações a até `raioKm` do ponto informado (PostGIS, distância na esfera). */
  async buscarIds({ latitude, longitude }: Coordenadas, raioKm = RAIO_REGIAO_KM): Promise<string[]> {
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM estacoes
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        ${raioKm * 1000},
        false
      )`;
    return linhas.map((linha) => linha.id);
  }

  /**
   * Combina o filtro de estação escolhido pelo usuário com a região: fora
   * dela, a estação escolhida simplesmente não aparece.
   */
  async filtroEstacao(estacaoId: string | undefined, regiao: Coordenadas | undefined) {
    if (!regiao) return estacaoId;
    const proximas = await this.buscarIds(regiao);
    if (estacaoId) return proximas.includes(estacaoId) ? estacaoId : { in: [] as string[] };
    return { in: proximas };
  }
}
