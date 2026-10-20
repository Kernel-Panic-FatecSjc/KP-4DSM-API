import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TelemetriaService } from '../../src/ingestao/telemetria.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real: os triggers barram UPDATE e DELETE direto em
// leituras_brutas e medidas, inclusive fora da API.
describe('Imutabilidade dos dados originais (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leituraBrutaId: string;
  let medidaId: string;
  let estacaoId: string;

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);

    const usuario = await prisma.usuario.create({
      data: { nome: 'Imutabilidade', email: emailDeTeste('imutabilidade'), senhaHash: 'x' },
    });
    const tipo = await prisma.tipoParametro.create({
      data: { nome: `${PREFIXO_TESTE}chuva`, unidade: 'mm', fator: 1, ganho: 0 },
    });
    const estacao = await prisma.estacao.create({
      data: {
        nome: `${PREFIXO_TESTE}Estação imutável`,
        endereco: 'Rua de teste',
        vid: `${PREFIXO_TESTE}imutavel-${Date.now()}`,
        usuarioId: usuario.id,
      },
    });
    const parametro = await prisma.parametro.create({
      data: { estacaoId: estacao.id, tipoParametroId: tipo.id },
    });
    const medida = await prisma.medida.create({
      data: { valor: 1.5, unixtime: 1_760_000_000n, parametroId: parametro.id, estacaoId: estacao.id },
    });

    leituraBrutaId = randomUUID();
    await app.get(TelemetriaService).registrarLeiturasBrutas([
      {
        id: leituraBrutaId,
        vidEstacao: estacao.vid,
        payload: { chuva: 1.5 },
        latitude: -23.1,
        longitude: -45.8,
        unixtimeDispositivo: 1_760_000_000,
      },
    ]);

    estacaoId = estacao.id;
    medidaId = medida.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('leituras_brutas', () => {
    it('recusa UPDATE com mensagem clara', async () => {
      await expect(
        prisma.$executeRaw`UPDATE leituras_brutas SET payload = '{}'::jsonb WHERE id = ${leituraBrutaId}`,
      ).rejects.toThrow('Leituras brutas são imutáveis');
    });

    it('recusa DELETE com mensagem clara', async () => {
      await expect(
        prisma.$executeRaw`DELETE FROM leituras_brutas WHERE id = ${leituraBrutaId}`,
      ).rejects.toThrow('Leituras brutas são imutáveis');
    });

    it('mantém a leitura intacta', async () => {
      const [leitura] = await prisma.$queryRaw<{ payload: unknown }[]>`
        SELECT payload FROM leituras_brutas WHERE id = ${leituraBrutaId}`;

      expect(leitura.payload).toEqual({ chuva: 1.5 });
    });
  });

  describe('medidas', () => {
    it('recusa UPDATE com mensagem clara', async () => {
      await expect(
        prisma.medida.update({ where: { id: medidaId }, data: { valor: 99 } }),
      ).rejects.toThrow('Medidas são imutáveis');
    });

    it('recusa DELETE com mensagem clara', async () => {
      await expect(prisma.medida.delete({ where: { id: medidaId } })).rejects.toThrow(
        'Medidas são imutáveis',
      );
    });

    it('recusa apagar a estação em cascata', async () => {
      await expect(prisma.estacao.delete({ where: { id: estacaoId } })).rejects.toThrow(
        'Medidas são imutáveis',
      );
      await expect(prisma.medida.findUnique({ where: { id: medidaId } })).resolves.toMatchObject({
        valor: 1.5,
      });
    });
  });
});
