import { BadRequestException } from '@nestjs/common';
import { EstatisticaService } from '../../../src/estatistica/estatistica.service';
import { ADMIN_A, LICITACAO_A, TECSUS } from '../sessoes';

const P1 = '2026-01-01T00:00:00.000Z|2026-01-31T23:59:59.000Z';
const P2 = '2026-02-01T00:00:00.000Z|2026-02-28T23:59:59.000Z';

function linha(estacaoId: string, mediana: number | null, extra: Record<string, unknown> = {}) {
  return {
    estacaoId,
    estacaoNome: `Estação ${estacaoId}`,
    quantidade: 10n,
    media: mediana,
    mediana,
    desvioPadrao: 1,
    variancia: 1,
    quartil1: mediana,
    quartil2: mediana,
    quartil3: mediana,
    minimo: mediana,
    maximo: mediana,
    ...extra,
  };
}

describe('EstatisticaService', () => {
  const prismaMock = { $queryRaw: jest.fn() };
  let service: EstatisticaService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
    service = new EstatisticaService(prismaMock as never);
  });

  describe('comparar', () => {
    it('recusa período fora do formato INICIO|FIM', async () => {
      await expect(service.comparar({ periodos: ['2026-01-01'], estacaoIds: ['e1'], parametroId: 'p' }, TECSUS)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('recusa período com início depois do fim', async () => {
      await expect(
        service.comparar({ periodos: ['2026-02-01T00:00:00.000Z|2026-01-01T00:00:00.000Z'], estacaoIds: ['e1'], parametroId: 'p' }, TECSUS),
      ).rejects.toThrow('Período inválido');
    });

    it('recusa períodos que se sobrepõem', async () => {
      await expect(
        service.comparar(
          { periodos: [P1, '2026-01-15T00:00:00.000Z|2026-02-15T00:00:00.000Z'], estacaoIds: ['e1'], parametroId: 'p' },
          TECSUS,
        ),
      ).rejects.toThrow('não podem se sobrepor');
    });

    it('exige ao menos uma estação', async () => {
      await expect(service.comparar({ periodos: [P1], estacaoIds: [], parametroId: 'p' }, TECSUS)).rejects.toThrow(
        'ao menos uma estação',
      );
    });

    it('converte as estatísticas de cada período e não compara com um período só', async () => {
      prismaMock.$queryRaw.mockResolvedValue([linha('e1', 20)]);

      const relatorio = await service.comparar({ periodos: [P1], estacaoIds: ['e1', 'e1'], parametroId: 'p' }, TECSUS);

      expect(relatorio.periodos).toHaveLength(1);
      expect(relatorio.periodos[0].estacoes[0]).toMatchObject({ estacaoId: 'e1', quantidade: 10, mediana: 20 });
      expect(relatorio.comparacoes).toEqual([]);
    });

    it('compara cada período com o primeiro: diferença absoluta e percentual', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([linha('e1', 20)]).mockResolvedValueOnce([linha('e1', 30)]);

      const relatorio = await service.comparar({ periodos: [P1, P2], estacaoIds: ['e1'], parametroId: 'p' }, TECSUS);

      expect(relatorio.comparacoes).toHaveLength(1);
      expect(relatorio.comparacoes[0]).toMatchObject({
        estacaoId: 'e1',
        periodoReferenciaIndice: 0,
        periodoComparadoIndice: 1,
        mediana: { diferencaAbsoluta: 10, diferencaPercentual: 50 },
      });
    });

    it('não calcula o percentual quando a referência é zero e não compara métrica sem valor', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([linha('e1', 0, { desvioPadrao: null })])
        .mockResolvedValueOnce([linha('e1', 5)]);

      const [comparacao] = (await service.comparar({ periodos: [P1, P2], estacaoIds: ['e1'], parametroId: 'p' }, TECSUS)).comparacoes;

      expect(comparacao.mediana).toMatchObject({ diferencaAbsoluta: 5, diferencaPercentual: null });
      expect(comparacao.desvioPadrao).toBeNull();
    });

    it('ignora na comparação a estação que não existia no período de referência', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([linha('e1', 20)]).mockResolvedValueOnce([linha('e2', 30)]);

      const relatorio = await service.comparar({ periodos: [P1, P2], estacaoIds: ['e1', 'e2'], parametroId: 'p' }, TECSUS);

      expect(relatorio.comparacoes).toEqual([]);
    });

    it('aponta como microclima de risco a estação a mais de 2 desvios do grupo', async () => {
      const estacoes = Array.from({ length: 9 }, (_, i) => linha(`e${i}`, 10));
      prismaMock.$queryRaw.mockResolvedValue([...estacoes, linha('fora', 100)]);

      const relatorio = await service.comparar({ periodos: [P1], estacaoIds: ['e0'], parametroId: 'p' }, TECSUS);

      expect(relatorio.microclimasRisco).toHaveLength(1);
      expect(relatorio.microclimasRisco[0]).toMatchObject({ periodoIndice: 0, estacaoId: 'fora', media: 100 });
    });

    it('não aponta risco quando as estações têm a mesma mediana ou nenhuma tem dado', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([linha('e1', 10), linha('e2', 10)]).mockResolvedValueOnce([linha('e1', null)]);

      const relatorio = await service.comparar({ periodos: [P1, P2], estacaoIds: ['e1'], parametroId: 'p' }, TECSUS);

      expect(relatorio.microclimasRisco).toEqual([]);
    });

    it('consulta só a licitação do admin da licitação', async () => {
      await service.comparar({ periodos: [P1], estacaoIds: ['e1'], parametroId: 'p' }, ADMIN_A);

      expect(prismaMock.$queryRaw.mock.calls[0][0].values).toContain(LICITACAO_A);
    });
  });
});
