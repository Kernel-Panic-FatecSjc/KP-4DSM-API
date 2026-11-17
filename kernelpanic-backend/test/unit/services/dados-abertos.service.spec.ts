import { BadRequestException } from '@nestjs/common';
import { DadosAbertosService, LIMITE_DIAS, LIMITE_DIAS_ALARMES } from '../../../src/dados-abertos/dados-abertos.service';

describe('DadosAbertosService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
    estacao: { count: jest.fn(), findMany: jest.fn() },
    alarme: { count: jest.fn(), findMany: jest.fn() },
  };
  let service: DadosAbertosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DadosAbertosService(prismaMock as never);
  });

  describe('medidas', () => {
    const consulta = { de: '2026-01-01', ate: '2026-01-02', granularidade: 'hora' as const };
    const linha = {
      estacaoId: 'e1',
      estacaoNome: 'Centro',
      parametro: 'Temperatura',
      unidade: '°C',
      agregacao: 'MEDIA',
      inicio: new Date('2026-01-01T10:00:00.000Z'),
      valor: 21.5,
      quantidadeLeituras: 12n,
      total: 40n,
    };

    it('devolve as linhas agregadas e o total da janela', async () => {
      prismaMock.$queryRaw.mockResolvedValue([linha]);

      const resposta = await service.medidas({ ...consulta, pagina: 1, tamanhoPagina: 10 });

      expect(resposta.dados).toEqual([
        {
          estacaoId: 'e1',
          estacaoNome: 'Centro',
          parametro: 'Temperatura',
          unidade: '°C',
          inicio: '2026-01-01T10:00:00.000Z',
          granularidade: 'hora',
          agregacao: 'MEDIA',
          valor: 21.5,
          quantidadeLeituras: 12,
        },
      ]);
      expect(resposta.paginacao).toEqual({ pagina: 1, tamanhoPagina: 10, total: 40 });
    });

    it('na primeira página vazia, o total é 0 sem consulta extra', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const resposta = await service.medidas(consulta);

      expect(resposta.paginacao.total).toBe(0);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('numa página além do fim, conta o total à parte', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 9n }]);

      const resposta = await service.medidas({ ...consulta, pagina: 5, tamanhoPagina: 10 });

      expect(resposta.dados).toEqual([]);
      expect(resposta.paginacao.total).toBe(9);
    });

    it('recusa o período acima do teto da granularidade', async () => {
      await expect(service.medidas({ de: '2026-01-01', ate: '2026-03-01', granularidade: 'hora' })).rejects.toThrow(
        `${LIMITE_DIAS.hora} dias`,
      );
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('estacoes', () => {
    it('lista o catálogo com os sensores, sem expor os parâmetros brutos', async () => {
      prismaMock.estacao.count.mockResolvedValue(1);
      prismaMock.estacao.findMany.mockResolvedValue([
        {
          id: 'e1',
          nome: 'Centro',
          latitude: 1,
          longitude: 2,
          statusOperacional: 'ATIVA',
          parametros: [{ tipoParametro: { nome: 'Temperatura', unidade: '°C' } }],
        },
      ]);

      const resposta = await service.estacoes({ pagina: 1, tamanhoPagina: 10 });

      expect(resposta.dados).toEqual([
        {
          id: 'e1',
          nome: 'Centro',
          latitude: 1,
          longitude: 2,
          statusOperacional: 'ATIVA',
          sensores: [{ nome: 'Temperatura', unidade: '°C' }],
        },
      ]);
      expect(resposta.paginacao).toMatchObject({ total: 1 });
    });

    it('filtra pelo status operacional quando informado', async () => {
      prismaMock.estacao.count.mockResolvedValue(0);
      prismaMock.estacao.findMany.mockResolvedValue([]);

      await service.estacoes({ status: 'INATIVA' } as never);

      expect(prismaMock.estacao.findMany.mock.calls[0][0].where).toEqual({ statusOperacional: 'INATIVA' });
    });
  });

  describe('alarmes', () => {
    it('devolve o histórico de alarmes sem dados de usuário', async () => {
      prismaMock.alarme.count.mockResolvedValue(1);
      prismaMock.alarme.findMany.mockResolvedValue([
        {
          id: 'a1',
          disparadoEm: new Date('2026-01-01T10:00:00.000Z'),
          status: 'ABERTO',
          alerta: { operador: 'MAIOR', valorLimite: 30, severidade: 'ALERTA' },
          medida: {
            valor: 35,
            estacao: { id: 'e1', nome: 'Centro' },
            parametro: { tipoParametro: { nome: 'Temperatura' } },
          },
        },
      ]);

      const resposta = await service.alarmes({ de: '2026-01-01', ate: '2026-01-02' });

      expect(resposta.dados[0]).toEqual({
        id: 'a1',
        disparadoEm: '2026-01-01T10:00:00.000Z',
        estacaoId: 'e1',
        estacaoNome: 'Centro',
        parametro: 'Temperatura',
        operador: 'MAIOR',
        valorLimite: 30,
        valorMedido: 35,
        severidade: 'ALERTA',
        status: 'ABERTO',
      });
    });

    it('aplica status, severidade e estação ao filtro', async () => {
      prismaMock.alarme.count.mockResolvedValue(0);
      prismaMock.alarme.findMany.mockResolvedValue([]);

      await service.alarmes({
        de: '2026-01-01',
        ate: '2026-01-02',
        status: 'ABERTO',
        severidade: 'ALERTA',
        estacaoId: 'e1',
      } as never);

      expect(prismaMock.alarme.findMany.mock.calls[0][0].where).toMatchObject({
        status: 'ABERTO',
        alerta: { severidade: 'ALERTA' },
        medida: { estacaoId: 'e1' },
      });
    });

    it('recusa o período acima de um ano', async () => {
      await expect(service.alarmes({ de: '2024-01-01', ate: '2026-01-01' })).rejects.toThrow(
        `${LIMITE_DIAS_ALARMES} dias`,
      );
      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });

    it('recusa o início depois do fim', async () => {
      await expect(service.alarmes({ de: '2026-02-01', ate: '2026-01-01' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });
  });
});
