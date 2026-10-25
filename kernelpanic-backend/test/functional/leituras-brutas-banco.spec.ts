import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LeiturasBrutasRepositorio } from '../../servicos/ingestao/leituras-brutas.repositorio';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real: a nova tentativa do flush regrava leituras brutas que
// podem já ter entrado (um sub-lote gravou e o seguinte falhou), e o
// ON CONFLICT (id) DO NOTHING precisa absorver isso sem erro nem duplicata.
describe('Gravação de leituras brutas (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repositorio: LeiturasBrutasRepositorio;

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    repositorio = new LeiturasBrutasRepositorio(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('regravar o mesmo lote não falha nem duplica', async () => {
    const leituras = [randomUUID(), randomUUID()].map((id) => ({
      id,
      vidEstacao: `${PREFIXO_TESTE}regravar`,
      payload: { chuva: 1 },
      latitude: -23.1,
      longitude: -45.8,
      unixtimeDispositivo: 1_760_000_000,
    }));

    await expect(repositorio.registrar(leituras.slice(0, 1))).resolves.toBe(1);
    await expect(repositorio.registrar(leituras)).resolves.toBe(1);

    const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM leituras_brutas WHERE id IN (${leituras[0].id}, ${leituras[1].id})`;
    expect(Number(total)).toBe(2);
  });
});
