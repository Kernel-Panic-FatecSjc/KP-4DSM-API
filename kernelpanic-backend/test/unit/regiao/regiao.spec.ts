import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { EstacoesProximasService } from '../../../src/regiao/estacoes-proximas.service';
import { coordenadasValidas, distanciaKm, resolverRegiao } from '../../../src/regiao/regiao';

const SAO_PAULO = { latitude: -23.5505, longitude: -46.6333 };
const RIO = { latitude: -22.9068, longitude: -43.1729 };

describe('regiao', () => {
  describe('distanciaKm', () => {
    it('calcula a distância entre São Paulo e Rio (~360 km)', () => {
      expect(distanciaKm(SAO_PAULO, RIO)).toBeCloseTo(361, -1);
    });

    it('é zero para o mesmo ponto', () => {
      expect(distanciaKm(SAO_PAULO, SAO_PAULO)).toBe(0);
    });
  });

  describe('resolverRegiao', () => {
    it('exige a região do visitante', () => {
      expect(() => resolverRegiao({}, false)).toThrow(BadRequestException);
    });

    it('não exige região de quem está logado', () => {
      expect(resolverRegiao({}, true)).toBeUndefined();
    });

    it('devolve as coordenadas informadas', () => {
      expect(resolverRegiao({ ...SAO_PAULO }, false)).toEqual(SAO_PAULO);
    });
  });

  describe('coordenadasValidas', () => {
    it.each([
      [SAO_PAULO, true],
      [{ latitude: 91, longitude: 0 }, false],
      [{ latitude: '-23', longitude: -46 }, false],
      [null, false],
    ])('%j -> %s', (valor, esperado) => {
      expect(coordenadasValidas(valor)).toBe(esperado);
    });
  });
});

describe('EstacoesProximasService.filtroEstacao', () => {
  const $queryRaw = jest.fn().mockResolvedValue([{ id: 'perto-1' }, { id: 'perto-2' }]);
  const service = new EstacoesProximasService({ $queryRaw } as unknown as PrismaService);

  beforeEach(() => $queryRaw.mockClear());

  it('mantém o filtro original quando não há região', async () => {
    await expect(service.filtroEstacao('estacao-1', undefined)).resolves.toBe('estacao-1');
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('restringe às estações do raio', async () => {
    await expect(service.filtroEstacao(undefined, SAO_PAULO)).resolves.toEqual({ in: ['perto-1', 'perto-2'] });
  });

  it('mantém a estação escolhida quando ela está no raio', async () => {
    await expect(service.filtroEstacao('perto-2', SAO_PAULO)).resolves.toBe('perto-2');
  });

  it('não devolve nada quando a estação escolhida está fora do raio', async () => {
    await expect(service.filtroEstacao('longe-1', SAO_PAULO)).resolves.toEqual({ in: [] });
  });
});
