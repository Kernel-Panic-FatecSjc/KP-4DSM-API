import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LeituraBrutaParaGravar {
  vidEstacao: string;
  payload: Record<string, number>;
  latitude: number;
  longitude: number;
  unixtimeDispositivo: number;
}

@Injectable()
export class TelemetriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarLeituraBruta(
    leitura: LeituraBrutaParaGravar,
  ): Promise<string> {
    const [linha] = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO leituras_brutas (id, "vidEstacao", payload, localizacao, "unixtimeDispositivo")
      VALUES (
        gen_random_uuid(),
        ${leitura.vidEstacao},
        ${JSON.stringify(leitura.payload)}::jsonb,
        ST_SetSRID(ST_MakePoint(${leitura.longitude}, ${leitura.latitude}), 4326),
        ${BigInt(leitura.unixtimeDispositivo)}
      )
      RETURNING id
    `;

    return linha.id;
  }
}
