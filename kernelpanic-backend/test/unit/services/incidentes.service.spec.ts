import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IncidentesService, LIMITE_ALARMES_INCIDENTES } from '../../../src/relatorios/incidentes.service';
import { ADMIN_A, LICITACAO_A, LICITACAO_B, TECSUS } from '../sessoes';

const PERIODO = { de: '2026-01-01', ate: '2026-01-31' };

describe('IncidentesService', () => {
  const prismaMock = {
    alarme: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
    licitacao: { findUnique: jest.fn() },
  };
  const proximasMock = { buscarIds: jest.fn() };
  let service: IncidentesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.alarme.findMany.mockResolvedValue([]);
    proximasMock.buscarIds.mockResolvedValue(['estacao-1']);
    service = new IncidentesService(prismaMock as never, proximasMock as never);
  });

  describe('relatorio', () => {
    it('sem alarmes, devolve as três severidades zeradas e nenhuma ocorrência', async () => {
      const relatorio = await service.relatorio(PERIODO, TECSUS);

      expect(relatorio.ocorrencias).toEqual([]);
      expect(relatorio.resumoPorEstacao).toEqual([]);
      expect(relatorio.resumoPorSeveridade.map((r) => [r.severidade, r.ocorrencias])).toEqual([
        ['ATENCAO', 0],
        ['ALERTA', 0],
        ['EMERGENCIA', 0],
      ]);
    });

    it('recusa período com início depois do fim, sem consultar o banco', async () => {
      await expect(service.relatorio({ de: '2026-02-01', ate: '2026-01-01' }, TECSUS)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });

    it('recusa data inválida', async () => {
      await expect(service.relatorio({ de: 'abc', ate: '2026-01-01' }, TECSUS)).rejects.toThrow('datas do período');
    });

    it('não consulta estações próximas quando não há região', async () => {
      await service.relatorio(PERIODO, TECSUS);

      expect(proximasMock.buscarIds).not.toHaveBeenCalled();
      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.alerta.parametro.estacaoId).toBeUndefined();
    });

    it('com região, filtra pelas estações dentro do raio', async () => {
      const relatorio = await service.relatorio({ ...PERIODO, latitude: -23.2, longitude: -45.9, raioKm: 5 }, TECSUS);

      expect(proximasMock.buscarIds).toHaveBeenCalledWith({ latitude: -23.2, longitude: -45.9, raioKm: 5 }, 5);
      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.alerta.parametro.estacaoId).toEqual({
        in: ['estacao-1'],
      });
      expect(relatorio.filtros.regiao).toEqual({ latitude: -23.2, longitude: -45.9, raioKm: 5 });
    });

    it('prende o admin da licitação à licitação dele', async () => {
      await service.relatorio(PERIODO, ADMIN_A);

      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.alerta.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação consultar a licitação de outro', async () => {
      await expect(service.relatorio({ ...PERIODO, licitacaoId: LICITACAO_B }, ADMIN_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });

    it('recusa o período com alarmes acima do limite', async () => {
      prismaMock.alarme.findMany.mockResolvedValue(new Array(LIMITE_ALARMES_INCIDENTES + 1).fill({}));

      await expect(service.relatorio(PERIODO, TECSUS)).rejects.toThrow('reduza o período');
    });
  });

  describe('emissor', () => {
    it('usa o nome do usuário e traz o órgão da licitação', async () => {
      const orgao = {
        orgaoNome: 'Prefeitura',
        orgaoMunicipio: 'SJC',
        orgaoUf: 'SP',
        numeroContrato: '1',
        codigoIdentificador: 'x',
      };
      prismaMock.usuario.findUnique.mockResolvedValue({ nome: 'Maria' });
      prismaMock.licitacao.findUnique.mockResolvedValue(orgao);

      await expect(service.emissor(ADMIN_A, LICITACAO_A)).resolves.toEqual({ emitidoPor: 'Maria', orgao });
    });

    it('cai no e-mail quando o usuário não tem cadastro e fica sem órgão sem licitação', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.emissor(TECSUS, undefined)).resolves.toEqual({ emitidoPor: TECSUS.email, orgao: null });
      expect(prismaMock.licitacao.findUnique).not.toHaveBeenCalled();
    });
  });
});
