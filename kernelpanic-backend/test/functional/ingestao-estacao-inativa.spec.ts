import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HEADER_CHAVE_INGESTAO } from '../../servicos/ingestao/http/guarda-chave-ingestao.guard';
import { IngestaoAppModule } from '../../servicos/ingestao/ingestao.module';
import { IngestaoService } from '../../servicos/ingestao/ingestao.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CHAVE_INGESTAO, HASH_CHAVE_INGESTAO } from '../fixtures';
import { criarAppDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// A ingestão só preserva o pacote original. O serviço de tratamento decide
// depois se ele vira medida; aqui confirmamos que o status da estação é
// informado, mas não altera nem o payload gravado nem cria medidas/alarmes.
describe('Ingestão de estação inativa (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const criarEstacao = async (status: 'ATIVA' | 'INATIVA', usuarioId: string, tipoParametroId: string) => {
    const vid = `${PREFIXO_TESTE}${status.toLowerCase()}-${Date.now()}`;
    const estacao = await prisma.estacao.create({
      data: {
        nome: `${PREFIXO_TESTE}Estação ${status}`,
        endereco: 'Rua de teste',
        vid,
        statusOperacional: status,
        chaveIngestaoHash: HASH_CHAVE_INGESTAO,
        usuarioId,
      },
    });
    const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId } });
    await prisma.alerta.create({
      data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 10, severidade: 'ALERTA' },
    });
    return { vid, estacaoId: estacao.id };
  };

  const enviar = async (vid: string) => {
    const resposta = await request(app.getHttpServer())
      .post('/ingestao/telemetria')
      .set(HEADER_CHAVE_INGESTAO, CHAVE_INGESTAO)
      .send({ vid, unixtime: 1_760_000_000, leituras: { chuva: 50 } })
      .expect(202);
    await app.get(IngestaoService).flush();
    return resposta.body as { leituraBrutaId: string; estacaoInativa: boolean };
  };

  const contar = async (estacaoId: string) => {
    const [{ medidas, alarmes }] = await prisma.$queryRaw<{ medidas: bigint; alarmes: bigint }[]>`
      SELECT
        (SELECT count(*) FROM medidas WHERE "estacaoId" = ${estacaoId}) AS medidas,
        (SELECT count(*) FROM alarmes a JOIN medidas m ON m.id = a."medidaId"
          WHERE m."estacaoId" = ${estacaoId}) AS alarmes`;
    return { medidas: Number(medidas), alarmes: Number(alarmes) };
  };

  const payloadBrutoGravado = async (id: string) => {
    const [leitura] = await prisma.$queryRaw<{ payload: unknown }[]>`
      SELECT payload FROM leituras_brutas WHERE id = ${id}`;
    return leitura?.payload;
  };

  let usuarioId: string;
  let tipoParametroId: string;

  beforeAll(async () => {
    app = await criarAppDeTeste({ modulo: IngestaoAppModule });
    prisma = app.get(PrismaService);
    const usuario = await prisma.usuario.create({
      data: { nome: 'Inativa', email: emailDeTeste('inativa'), senhaHash: 'x' },
    });
    const tipo = await prisma.tipoParametro.create({
      // o nome do sensor no payload casa com o nome do tipoParametro da estação
      data: { nome: 'chuva', unidade: 'mm', fator: 1, ganho: 0 },
    });
    usuarioId = usuario.id;
    tipoParametroId = tipo.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('estação ativa: preserva o pacote bruto sem processá-lo', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA', usuarioId, tipoParametroId);
    const resposta = await enviar(vid);

    expect(resposta.estacaoInativa).toBe(false);
    expect(await payloadBrutoGravado(resposta.leituraBrutaId)).toEqual({ chuva: 50 });
    expect(await contar(estacaoId)).toEqual({ medidas: 0, alarmes: 0 });
  });

  it('estação inativa: guarda o pacote bruto e não cria medida nem alarme', async () => {
    const { vid, estacaoId } = await criarEstacao('INATIVA', usuarioId, tipoParametroId);

    const resposta = await enviar(vid);

    expect(resposta.estacaoInativa).toBe(true);
    expect(await payloadBrutoGravado(resposta.leituraBrutaId)).toEqual({ chuva: 50 });
    expect(await contar(estacaoId)).toEqual({ medidas: 0, alarmes: 0 });
  });
});
