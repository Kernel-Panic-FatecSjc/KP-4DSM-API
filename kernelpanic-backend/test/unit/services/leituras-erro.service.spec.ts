import { ForbiddenException } from '@nestjs/common';
import { LeiturasErroService } from '../../../src/leituras-brutas/leituras-erro.service';
import { ADMIN_A, LICITACAO_A, LICITACAO_B, TECSUS } from '../sessoes';

describe('LeiturasErroService', () => {
  const prismaMock = { leituraErro: { findMany: jest.fn(), count: jest.fn() } };
  let service: LeiturasErroService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.leituraErro.findMany.mockResolvedValue([{ id: 'e1', unixtime: 1_760_000_000n, motivo: 'ACIMA_DO_MAXIMO' }]);
    prismaMock.leituraErro.count.mockResolvedValue(1);
    service = new LeiturasErroService(prismaMock as never);
  });

  describe('listar', () => {
    it('devolve as leituras paginadas, com o unixtime como texto', async () => {
      const resultado = await service.listar({ pagina: 2, tamanho: 10 }, TECSUS);

      expect(resultado).toEqual({
        itens: [{ id: 'e1', unixtime: '1760000000', motivo: 'ACIMA_DO_MAXIMO' }],
        total: 1,
        pagina: 2,
        tamanho: 10,
      });
      expect(prismaMock.leituraErro.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });

    it('usa a página 1 com 50 itens quando a paginação não é informada', async () => {
      const resultado = await service.listar({}, TECSUS);

      expect(resultado).toMatchObject({ pagina: 1, tamanho: 50 });
    });

    it('prende o admin da licitação à licitação dele', async () => {
      await service.listar({}, ADMIN_A);

      expect(prismaMock.leituraErro.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação filtrar a licitação de outro', async () => {
      await expect(service.listar({ licitacaoId: LICITACAO_B }, ADMIN_A)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.leituraErro.findMany).not.toHaveBeenCalled();
    });

    it('aplica motivo, vid (sem espaços, sem diferenciar maiúsculas) e período', async () => {
      await service.listar(
        { motivo: 'ACIMA_DO_MAXIMO', vidEstacao: '  ESP32 ', de: '2026-01-01T00:00:00.000Z', ate: '2026-01-02T00:00:00.000Z' } as never,
        TECSUS,
      );

      expect(prismaMock.leituraErro.findMany.mock.calls[0][0].where).toMatchObject({
        motivo: 'ACIMA_DO_MAXIMO',
        vidEstacao: { contains: 'ESP32', mode: 'insensitive' },
        registradoEm: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-02T00:00:00.000Z') },
      });
    });

    it('ignora o filtro de vid em branco', async () => {
      await service.listar({ vidEstacao: '   ' }, TECSUS);

      expect(prismaMock.leituraErro.findMany.mock.calls[0][0].where.vidEstacao).toBeUndefined();
    });
  });
});
