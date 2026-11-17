import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LINHAS_POR_LOTE_CSV } from '../../../src/exportacao/csv';
import { LeiturasBrutasService } from '../../../src/leituras-brutas/leituras-brutas.service';
import { ADMIN_A, LICITACAO_B, TECSUS } from '../sessoes';

function bruta(id: string, recebidoEm: string) {
  return {
    id,
    vidEstacao: 'ESP32-1',
    recebidoEm: new Date(recebidoEm),
    unixtimeDispositivo: 1_760_000_000n,
    latitude: -23.2,
    longitude: -45.9,
    payload: { temperatura_c: 20 },
  };
}

const PERIODO = { de: '2026-01-01T00:00:00.000Z', ate: '2026-01-02T00:00:00.000Z' };

describe('LeiturasBrutasService', () => {
  const prismaMock = { $queryRaw: jest.fn() };
  let service: LeiturasBrutasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeiturasBrutasService(prismaMock as never);
  });

  describe('listar', () => {
    it('devolve a página com o total e o unixtime do dispositivo como texto', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([bruta('b1', '2026-01-01T10:00:00.000Z')])
        .mockResolvedValueOnce([{ total: 7n }]);

      const resultado = await service.listar({ pagina: 2, tamanho: 5 }, TECSUS);

      expect(resultado).toMatchObject({ total: 7, pagina: 2, tamanho: 5 });
      expect(resultado.itens[0]).toMatchObject({ id: 'b1', unixtimeDispositivo: '1760000000' });
    });

    it('devolve total 0 quando a contagem vem vazia', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(service.listar({}, TECSUS)).resolves.toMatchObject({ itens: [], total: 0, pagina: 1, tamanho: 50 });
    });

    it('nega ao admin da licitação filtrar a licitação de outro, sem consultar o banco', async () => {
      await expect(service.listar({ licitacaoId: LICITACAO_B }, ADMIN_A)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('camposDaExportacao', () => {
    it('devolve os nomes de sensor presentes no período', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ chave: 'temperatura_c' }, { chave: 'umidade_pct' }]);

      await expect(service.camposDaExportacao(PERIODO, TECSUS)).resolves.toEqual(['temperatura_c', 'umidade_pct']);
    });

    it('exige o período completo', async () => {
      await expect(service.camposDaExportacao({ de: PERIODO.de }, TECSUS)).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('exportar', () => {
    async function coletar(gerador: AsyncGenerator<unknown[]>) {
      const lotes: unknown[][] = [];
      for await (const lote of gerador) lotes.push(lote);
      return lotes;
    }

    it('não gera lote quando o período não tem leituras', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(coletar(service.exportar(PERIODO, TECSUS))).resolves.toEqual([]);
    });

    it('para no primeiro lote incompleto', async () => {
      prismaMock.$queryRaw.mockResolvedValue([bruta('b1', '2026-01-01T10:00:00.000Z')]);

      const lotes = await coletar(service.exportar(PERIODO, TECSUS));

      expect(lotes).toHaveLength(1);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('segue pedindo lotes enquanto vierem cheios', async () => {
      const cheio = Array.from({ length: LINHAS_POR_LOTE_CSV }, (_, i) => bruta(`b${i}`, '2026-01-01T10:00:00.000Z'));
      prismaMock.$queryRaw.mockResolvedValueOnce(cheio).mockResolvedValueOnce([bruta('ultima', '2026-01-01T09:00:00.000Z')]);

      const lotes = await coletar(service.exportar(PERIODO, TECSUS));

      expect(lotes.map((lote) => lote.length)).toEqual([LINHAS_POR_LOTE_CSV, 1]);
    });

    it('exige o período completo', async () => {
      await expect(coletar(service.exportar({}, TECSUS))).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
