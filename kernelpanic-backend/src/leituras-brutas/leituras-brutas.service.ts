import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { exigirPeriodo, LINHAS_POR_LOTE_CSV } from '../exportacao/csv';
import { PrismaService } from '../prisma/prisma.service';
import { ListarLeiturasBrutasQueryDto } from './dto/listar-leituras-brutas-query.dto';
import { ListaLeiturasBrutasRespostaDto } from './dto/lista-leituras-brutas-resposta.dto';
import { LeituraBrutaResposta, LeituraBrutaRespostaDto } from './dto/leitura-bruta-resposta.dto';

interface LeituraBrutaConsulta extends Omit<LeituraBrutaResposta, 'unixtimeDispositivo'> {
  unixtimeDispositivo: bigint;
}

const COLUNAS = Prisma.sql`lb.id, lb."vidEstacao", lb."recebidoEm",
  lb."unixtimeDispositivo", ST_Y(lb.localizacao)::float8 AS latitude,
  ST_X(lb.localizacao)::float8 AS longitude, lb.payload`;

function paraResposta(registro: LeituraBrutaConsulta): LeituraBrutaRespostaDto {
  return new LeituraBrutaRespostaDto({ ...registro, unixtimeDispositivo: registro.unixtimeDispositivo.toString() });
}

@Injectable()
export class LeiturasBrutasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * leituras_brutas não tem licitacaoId: o pacote é da licitação da estação
   * dona do vid. O filtro de licitação fica aqui, no backend, sempre que quem
   * consulta não é a Tecsus.
   */
  private filtro(query: ListarLeiturasBrutasQueryDto, usuario: UsuarioLogado, periodo = true): Prisma.Sql {
    const licitacaoId = licitacaoDoEscopo(usuario, query.licitacaoId) ?? null;
    const de = periodo && query.de ? new Date(query.de) : null;
    const ate = periodo && query.ate ? new Date(query.ate) : null;
    const vidEstacao = query.vidEstacao?.trim() ? `%${query.vidEstacao.trim()}%` : null;
    const campo = query.campo?.trim() ? `%${query.campo.trim()}%` : null;

    return Prisma.sql`
      (${licitacaoId}::text IS NULL OR lb."vidEstacao" IN (
        SELECT vid FROM estacoes WHERE "licitacaoId" = ${licitacaoId}
      ))
      AND (${de}::timestamp IS NULL OR lb."recebidoEm" >= ${de})
      AND (${ate}::timestamp IS NULL OR lb."recebidoEm" <= ${ate})
      AND (${vidEstacao}::text IS NULL OR lb."vidEstacao" ILIKE ${vidEstacao})
      AND (${campo}::text IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(lb.payload) AS campos(chave)
        WHERE campos.chave ILIKE ${campo}
      ))`;
  }

  async listar(query: ListarLeiturasBrutasQueryDto, usuario: UsuarioLogado): Promise<ListaLeiturasBrutasRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const offset = (pagina - 1) * tamanho;
    const where = this.filtro(query, usuario);

    const [registros, contagem] = await Promise.all([
      this.prisma.$queryRaw<LeituraBrutaConsulta[]>`
        SELECT ${COLUNAS}
        FROM leituras_brutas lb
        WHERE ${where}
        ORDER BY lb."recebidoEm" DESC, lb.id DESC
        LIMIT ${tamanho} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total FROM leituras_brutas lb WHERE ${where}
      `,
    ]);

    return new ListaLeiturasBrutasRespostaDto(
      registros.map(paraResposta),
      Number(contagem[0]?.total ?? 0n),
      pagina,
      tamanho,
    );
  }

  /** Nomes de sensor presentes no período, para as colunas fixas do CSV. */
  async camposDaExportacao(query: ListarLeiturasBrutasQueryDto, usuario: UsuarioLogado): Promise<string[]> {
    const { de, ate } = exigirPeriodo(query.de, query.ate);
    const linhas = await this.prisma.$queryRaw<{ chave: string }[]>`
      SELECT DISTINCT jsonb_object_keys(lb.payload) AS chave
      FROM leituras_brutas lb
      WHERE ${this.filtro(query, usuario, false)}
        AND lb."recebidoEm" >= ${de} AND lb."recebidoEm" <= ${ate}
      ORDER BY 1
    `;
    return linhas.map((linha) => linha.chave);
  }

  /**
   * Leituras do período em lotes por keyset (recebidoEm, id), da mais nova
   * para a mais antiga: cada lote é uma consulta pelo índice, e nem a API nem
   * o navegador seguram o período inteiro na memória.
   */
  async *exportar(query: ListarLeiturasBrutasQueryDto, usuario: UsuarioLogado): AsyncGenerator<LeituraBrutaRespostaDto[]> {
    const { de, ate } = exigirPeriodo(query.de, query.ate);
    const where = this.filtro(query, usuario, false);
    let cursor: { recebidoEm: Date; id: string } | null = null;

    for (;;) {
      const posicao: Prisma.Sql = cursor
        ? Prisma.sql`AND (lb."recebidoEm", lb.id) < (${cursor.recebidoEm}::timestamp, ${cursor.id})`
        : Prisma.empty;
      const registros: LeituraBrutaConsulta[] = await this.prisma.$queryRaw<LeituraBrutaConsulta[]>`
        SELECT ${COLUNAS}
        FROM leituras_brutas lb
        WHERE ${where}
          AND lb."recebidoEm" >= ${de} AND lb."recebidoEm" <= ${ate}
          ${posicao}
        ORDER BY lb."recebidoEm" DESC, lb.id DESC
        LIMIT ${LINHAS_POR_LOTE_CSV}
      `;
      if (registros.length === 0) return;
      yield registros.map(paraResposta);
      const ultimo = registros[registros.length - 1];
      cursor = { recebidoEm: ultimo.recebidoEm, id: ultimo.id };
      if (registros.length < LINHAS_POR_LOTE_CSV) return;
    }
  }
}
