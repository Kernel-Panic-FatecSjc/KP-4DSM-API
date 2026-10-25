import { Test, TestingModule } from '@nestjs/testing';
import { LeituraBrutaParaGravar, LeiturasBrutasRepositorio } from '../../../../servicos/ingestao/leituras-brutas.repositorio';
import { PrismaService } from '../../../../src/prisma/prisma.service';

const leitura = (indice: number): LeituraBrutaParaGravar => ({
  id: `bruta-${indice}`,
  vidEstacao: 'ESP32-00001',
  payload: { temperatura: 20 + indice },
  latitude: -23.1,
  longitude: -45.8,
  unixtimeDispositivo: 1_760_000_000 + indice,
});

describe('LeiturasBrutasRepositorio', () => {
  let repositorio: LeiturasBrutasRepositorio;
  const prismaMock = { $executeRawUnsafe: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$executeRawUnsafe.mockImplementation((_sql: string, ...valores: unknown[]) => valores.length / 6);

    const module: TestingModule = await Test.createTestingModule({
      providers: [LeiturasBrutasRepositorio, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repositorio = module.get(LeiturasBrutasRepositorio);
  });

  it('grava o lote num INSERT só, com a posição em geometry e ignorando id repetido', async () => {
    await expect(repositorio.registrar([leitura(1), leitura(2)])).resolves.toBe(2);

    const [sql, ...valores] = prismaMock.$executeRawUnsafe.mock.calls[0];
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(sql).toContain('ST_SetSRID(ST_MakePoint(');
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    // longitude antes da latitude (ST_MakePoint(x, y)) e unixtime em BigInt
    expect(valores.slice(0, 6)).toEqual(['bruta-1', 'ESP32-00001', '{"temperatura":21}', -45.8, -23.1, 1_760_000_001n]);
  });

  it('quebra em mais de um INSERT acima de 10 mil linhas (limite de parâmetros do Postgres)', async () => {
    // Função simples, e não o jest.fn: o mock guardaria os 60 mil argumentos de cada chamada.
    const linhasPorInsert: number[] = [];
    (repositorio as unknown as { prisma: unknown }).prisma = {
      $executeRawUnsafe: (_sql: string, ...valores: unknown[]) => {
        linhasPorInsert.push(valores.length / 6);
        return Promise.resolve(valores.length / 6);
      },
    };
    const lote = Array.from({ length: 10_001 }, (_, i) => leitura(i));

    await expect(repositorio.registrar(lote)).resolves.toBe(10_001);
    expect(linhasPorInsert).toEqual([10_000, 1]);
  });

  it('não vai ao banco com o lote vazio', async () => {
    await expect(repositorio.registrar([])).resolves.toBe(0);
    expect(prismaMock.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
