import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calcularHashChaveIngestao } from '../../../src/ingestao/chave-ingestao';
import {
  GuardaChaveIngestao,
  HEADER_CHAVE_INGESTAO,
} from '../../../src/ingestao/guarda-chave-ingestao.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';

const CHAVE = 'chave-da-estacao-1';
const HASH_POR_VID: Record<string, string | null> = {
  'ESP32-00001': calcularHashChaveIngestao(CHAVE),
  'ESP32-00002': calcularHashChaveIngestao('chave-da-estacao-2'),
  'ESP32-SEM-CHAVE': null,
};

const prismaMock = {
  estacao: {
    findUnique: jest.fn(({ where }: { where: { vid: string } }) =>
      where.vid in HASH_POR_VID ? { chaveIngestaoHash: HASH_POR_VID[where.vid] } : null,
    ),
  },
};

const contextoCom = (requisicao: { headers?: object; body?: object; params?: object }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, params: {}, ...requisicao }) }),
  }) as unknown as ExecutionContext;

const guardaCom = (config: Record<string, string> = {}) =>
  new GuardaChaveIngestao(
    prismaMock as unknown as PrismaService,
    { get: (chave: string) => config[chave] } as unknown as ConfigService,
  );

const comChave = (chave: string) => ({ [HEADER_CHAVE_INGESTAO]: chave });

describe('GuardaChaveIngestao', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aceita a chave da própria estação, com o vid no corpo ou na URL', async () => {
    await expect(
      guardaCom().canActivate(contextoCom({ headers: comChave(CHAVE), body: { vid: 'ESP32-00001' } })),
    ).resolves.toBe(true);
    await expect(
      guardaCom().canActivate(contextoCom({ headers: comChave(CHAVE), params: { vid: 'ESP32-00001' } })),
    ).resolves.toBe(true);
  });

  it('recusa a chave de uma estação usada com o vid de outra', async () => {
    await expect(
      guardaCom().canActivate(contextoCom({ headers: comChave(CHAVE), body: { vid: 'ESP32-00002' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa chave ausente, errada, vid desconhecido e estação ainda sem chave', async () => {
    const casos = [
      { body: { vid: 'ESP32-00001' } },
      { headers: comChave('errada'), body: { vid: 'ESP32-00001' } },
      { headers: comChave(CHAVE), body: { vid: 'ESP32-DESCONHECIDA' } },
      { headers: comChave(CHAVE), body: { vid: 'ESP32-SEM-CHAVE' } },
      { headers: comChave(CHAVE), body: {} },
    ];

    for (const caso of casos) {
      await expect(guardaCom().canActivate(contextoCom(caso))).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('libera a rota sem chave com INGESTAO_ROTA_ABERTA em desenvolvimento', async () => {
    const guarda = guardaCom({ INGESTAO_ROTA_ABERTA: 'true', NODE_ENV: 'development' });

    await expect(guarda.canActivate(contextoCom({ body: { vid: 'ESP32-00002' } }))).resolves.toBe(true);
    expect(prismaMock.estacao.findUnique).not.toHaveBeenCalled();
  });

  it('impede a API de subir com a rota aberta fora de desenvolvimento', () => {
    expect(() => guardaCom({ INGESTAO_ROTA_ABERTA: 'true', NODE_ENV: 'production' })).toThrow(
      /INGESTAO_ROTA_ABERTA/,
    );
    expect(() => guardaCom({ INGESTAO_ROTA_ABERTA: 'true' })).toThrow(/INGESTAO_ROTA_ABERTA/);
  });
});
