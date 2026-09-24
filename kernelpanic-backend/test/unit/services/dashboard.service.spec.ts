import { BadRequestException } from '@nestjs/common';
import { DashboardService } from '../../../src/dashboard/dashboard.service';

function criarPrismaMock() {
  return {
    estacao: { findMany: jest.fn().mockResolvedValue([]) },
    medida: { findMany: jest.fn().mockResolvedValue([]) },
    alarme: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe('DashboardService', () => {
  it('aplica o período de sete dias e o filtro de estação', async () => {
    const prisma = criarPrismaMock();
    const service = new DashboardService(prisma as never);

    const resposta = await service.buscarDados({ periodo: '7d', estacaoId: 'estacao-1' });
    const filtroMedidas = prisma.medida.findMany.mock.calls[0][0].where;

    expect(resposta.periodo.ate).toBeDefined();
    expect(new Date(resposta.periodo.ate).getTime() - new Date(resposta.periodo.de).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(filtroMedidas.estacaoId).toBe('estacao-1');
    expect(prisma.estacao.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'estacao-1' } }));
  });

  it('exige um intervalo customizado completo e em ordem válida', async () => {
    const prisma = criarPrismaMock();
    const service = new DashboardService(prisma as never);

    await expect(service.buscarDados({ periodo: 'customizado', de: '2026-09-23T12:00:00.000Z' })).rejects.toThrow(
      new BadRequestException('O período customizado exige de e ate.'),
    );
    await expect(service.buscarDados({ de: '2026-09-24T00:00:00.000Z', ate: '2026-09-23T00:00:00.000Z' })).rejects.toThrow(
      new BadRequestException('A data de início deve ser anterior ou igual à data final.'),
    );
    expect(prisma.medida.findMany).not.toHaveBeenCalled();
  });
});
