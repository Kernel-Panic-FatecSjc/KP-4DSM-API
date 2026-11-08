import { BadRequestException } from '@nestjs/common';
import { RelatoriosService } from '../../../src/relatorios/relatorios.service';
import { ADMIN_A, LICITACAO_A, TECSUS } from '../sessoes';

const ESTACAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TIPO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function linha(periodo: Date | null, totalPeriodo: number) {
  return {
    estacaoId: ESTACAO_ID,
    estacaoNome: 'Estação Centro',
    tipoParametroId: TIPO_ID,
    tipoParametroNome: 'Pluviômetro',
    unidade: 'mm',
    agregacao: 'SOMA' as const,
    periodo,
    totalPeriodo,
    valor: totalPeriodo ? 20 : 5,
    soma: totalPeriodo ? 20 : 5,
    media: 2.5,
    minimo: 1,
    maximo: 4,
    leituras: BigInt(totalPeriodo ? 8 : 2),
  };
}

describe('RelatoriosService', () => {
  it('agrega no PostgreSQL por granularidade e também calcula o total do período', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          linha(null, 1),
          linha(new Date('2026-01-01T00:00:00.000Z'), 0),
          linha(new Date('2026-01-02T00:00:00.000Z'), 0),
        ]),
    };
    const service = new RelatoriosService(prisma as never);

    const resposta = await service.historicoClimatico(
      {
        de: '2026-01-01',
        ate: '2026-01-02',
        granularidade: 'dia',
        estacaoIds: [ESTACAO_ID],
      },
      TECSUS,
    );

    expect(resposta).toMatchObject({
      de: '2026-01-01T00:00:00.000Z',
      ate: '2026-01-02T23:59:59.999Z',
      granularidade: 'dia',
      estacoes: [
        {
          id: ESTACAO_ID,
          parametros: [
            {
              id: TIPO_ID,
              agregacao: 'SOMA',
              periodos: [
                { valor: 5, soma: 5, media: 2.5, leituras: 2 },
                { valor: 5, soma: 5 },
              ],
              totalPeriodo: { valor: 20, soma: 20, media: 2.5, leituras: 8 },
            },
          ],
        },
      ],
    });

    const [fragmentos, ...valores] = (prisma.$queryRaw as jest.Mock).mock
      .calls[0];
    const sql = fragmentos.join(' ');
    expect(sql).toContain('date_trunc');
    expect(sql).toContain('GROUPING SETS');
    expect(sql).toContain('SUM("valor")');
    expect(sql).toContain('AVG("valor")');
    expect(sql).toContain('MIN("valor")');
    expect(sql).toContain('MAX("valor")');
    expect(valores).toContain('day');
    expect(
      JSON.stringify(valores, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ).toContain(ESTACAO_ID);
  });

  it('consulta um período de um ano sem carregar leituras individuais na aplicação', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const service = new RelatoriosService(prisma as never);

    const resposta = await service.historicoClimatico(
      { de: '2025-01-01', ate: '2025-12-31', granularidade: 'dia' },
      TECSUS,
    );

    expect(resposta.estacoes).toEqual([]);
    const [fragmentos] = (prisma.$queryRaw as jest.Mock).mock.calls[0];
    const sql = fragmentos.join(' ');
    expect(sql).toContain('GROUPING SETS');
    expect(sql).not.toContain('LIMIT');
  });

  it('limita o histórico à licitação do usuário', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const service = new RelatoriosService(prisma as never);

    await service.historicoClimatico(
      { de: '2026-01-01', ate: '2026-01-02', granularidade: 'hora' },
      ADMIN_A,
    );

    const [fragmentos, ...valores] = (prisma.$queryRaw as jest.Mock).mock
      .calls[0];
    expect(fragmentos.join(' ')).toContain('WHERE TRUE');
    expect(
      JSON.stringify(valores, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ).toContain(LICITACAO_A);
  });

  it('usa a média como valor consolidado quando o tipo está configurado como MEDIA', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          ...linha(new Date('2026-01-01T00:00:00.000Z'), 0),
          agregacao: 'MEDIA',
          valor: 2.5,
        },
        {
          ...linha(null, 1),
          agregacao: 'MEDIA',
          valor: 2.5,
        },
      ]),
    };
    const service = new RelatoriosService(prisma as never);

    const resposta = await service.historicoClimatico(
      { de: '2026-01-01', ate: '2026-01-01', granularidade: 'dia' },
      TECSUS,
    );

    expect(resposta.estacoes[0].parametros[0]).toMatchObject({
      agregacao: 'MEDIA',
      periodos: [{ valor: 2.5 }],
      totalPeriodo: { valor: 2.5 },
    });
  });

  it('rejeita período invertido antes de consultar o banco', async () => {
    const prisma = { $queryRaw: jest.fn() };
    const service = new RelatoriosService(prisma as never);

    await expect(
      service.historicoClimatico(
        { de: '2026-02-01', ate: '2026-01-01', granularidade: 'dia' },
        TECSUS,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
