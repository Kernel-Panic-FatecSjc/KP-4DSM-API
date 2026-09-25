import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListarLeiturasBrutasQueryDto } from './dto/listar-leituras-brutas-query.dto';
import { ListaLeiturasBrutasRespostaDto } from './dto/lista-leituras-brutas-resposta.dto';
import { LeituraBrutaResposta, LeituraBrutaRespostaDto } from './dto/leitura-bruta-resposta.dto';

interface LeituraBrutaConsulta extends Omit<LeituraBrutaResposta, 'unixtimeDispositivo'> {
  unixtimeDispositivo: bigint;
}

@Injectable()
export class LeiturasBrutasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarLeiturasBrutasQueryDto): Promise<ListaLeiturasBrutasRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const offset = (pagina - 1) * tamanho;
    const de = query.de ? new Date(query.de) : null;
    const ate = query.ate ? new Date(query.ate) : null;
    const vidEstacao = query.vidEstacao?.trim() ? `%${query.vidEstacao.trim()}%` : null;
    const campo = query.campo?.trim() ? `%${query.campo.trim()}%` : null;

    const [registros, contagem] = await Promise.all([
      this.prisma.$queryRaw<LeituraBrutaConsulta[]>`
        SELECT lb.id, lb."vidEstacao", lb."recebidoEm",
          lb."unixtimeDispositivo", ST_Y(lb.localizacao)::float8 AS latitude,
          ST_X(lb.localizacao)::float8 AS longitude, lb.payload
        FROM leituras_brutas lb
        WHERE (${de}::timestamp IS NULL OR lb."recebidoEm" >= ${de})
          AND (${ate}::timestamp IS NULL OR lb."recebidoEm" <= ${ate})
          AND (${vidEstacao}::text IS NULL OR lb."vidEstacao" ILIKE ${vidEstacao})
          AND (${campo}::text IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_object_keys(lb.payload) AS campos(chave)
            WHERE campos.chave ILIKE ${campo}
          ))
        ORDER BY lb."recebidoEm" DESC
        LIMIT ${tamanho} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total
        FROM leituras_brutas lb
        WHERE (${de}::timestamp IS NULL OR lb."recebidoEm" >= ${de})
          AND (${ate}::timestamp IS NULL OR lb."recebidoEm" <= ${ate})
          AND (${vidEstacao}::text IS NULL OR lb."vidEstacao" ILIKE ${vidEstacao})
          AND (${campo}::text IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_object_keys(lb.payload) AS campos(chave)
            WHERE campos.chave ILIKE ${campo}
          ))
      `,
    ]);

    const itens = registros.map((registro) => new LeituraBrutaRespostaDto({
      ...registro,
      unixtimeDispositivo: registro.unixtimeDispositivo.toString(),
    }));

    return new ListaLeiturasBrutasRespostaDto(
      itens,
      Number(contagem[0]?.total ?? 0n),
      pagina,
      tamanho,
    );
  }
}