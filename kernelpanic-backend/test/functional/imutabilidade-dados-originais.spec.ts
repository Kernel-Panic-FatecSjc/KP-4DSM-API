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

  describe('leituras_erro', () => {
    const novoErro = () => ({
      id: randomUUID(),
      leituraBrutaId,
      vidEstacao: `${PREFIXO_TESTE}erro`,
      nomeSensor: 'temperatura',
      parametroId: null,
      valor: 150,
      unixtime: 1_760_000_000,
      motivo: 'ACIMA_DO_MAXIMO' as const,
      valorMinimo: -40,
      valorMaximo: 60,
    });

    it('grava a leitura com a faixa vigente, e regravar o mesmo lote não duplica', async () => {
      const registro = novoErro();
      const telemetria = app.get(TelemetriaService);

      await expect(telemetria.registrarLeiturasErro([registro])).resolves.toBe(1);
      await expect(telemetria.registrarLeiturasErro([registro])).resolves.toBe(0);

      const gravadas = await prisma.leituraErro.findMany({ where: { id: registro.id } });
      expect(gravadas).toHaveLength(1);
      expect(gravadas[0]).toMatchObject({
        valor: 150,
        motivo: 'ACIMA_DO_MAXIMO',
        valorMinimo: -40,
        valorMaximo: 60,
      });
    });

    it('recusa UPDATE e DELETE com mensagem clara', async () => {
      const registro = novoErro();
      await app.get(TelemetriaService).registrarLeiturasErro([registro]);

      await expect(
        prisma.leituraErro.update({ where: { id: registro.id }, data: { valor: 1 } }),
      ).rejects.toThrow('Leituras com erro são imutáveis');
      await expect(prisma.leituraErro.delete({ where: { id: registro.id } })).rejects.toThrow(
        'Leituras com erro são imutáveis',
      );
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
