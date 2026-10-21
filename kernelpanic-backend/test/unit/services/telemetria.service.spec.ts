import { Test, TestingModule } from '@nestjs/testing';
import { LeituraErroParaGravar, TelemetriaService } from '../../../src/ingestao/telemetria.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const ERRO: LeituraErroParaGravar = {
  id: 'erro-1',
  leituraBrutaId: 'bruta-1',
  vidEstacao: 'ESP32-00001',
  nomeSensor: 'temperatura',
  parametroId: 'parametro-temp',
  valor: 150,
  unixtime: 1_760_000_000,
  motivo: 'ACIMA_DO_MAXIMO',
  valorMinimo: -40,
  valorMaximo: 60,
};

describe('TelemetriaService.registrarLeiturasErro', () => {
  let service: TelemetriaService;
  const prismaMock = { leituraErro: { createMany: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.leituraErro.createMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetriaService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(TelemetriaService);
  });

  it('grava o lote num createMany só, com o unixtime em BigInt e ignorando id repetido', async () => {
    await expect(service.registrarLeiturasErro([ERRO])).resolves.toBe(1);

    expect(prismaMock.leituraErro.createMany).toHaveBeenCalledWith({
      data: [{ ...ERRO, unixtime: 1_760_000_000n }],
      skipDuplicates: true,
    });
  });

  it('não vai ao banco quando não há leitura com erro', async () => {
    await expect(service.registrarLeiturasErro([])).resolves.toBe(0);
    expect(prismaMock.leituraErro.createMany).not.toHaveBeenCalled();
  });
});
