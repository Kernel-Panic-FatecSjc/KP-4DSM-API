import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import request from 'supertest';
import { LINHAS_POR_LOTE_CSV } from '../../src/exportacao/csv';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real e mais linhas que um lote (SCRUM-114): a exportação CSV sai em
// streaming, em lotes por keyset, sem repetir nem perder linha, inclusive quando
// todas têm o mesmo timestamp e só o id desempata. As linhas ficam em 2031 para
// não se misturar com o que as outras suítes gravam.
describe('Exportação CSV em streaming (funcional)', () => {
  const TOTAL = 2 * LINHAS_POR_LOTE_CSV + 500; // 3 lotes: cheio, cheio e parcial
  const MOMENTO = '2031-06-01T12:00:00.000Z';
  const periodo = 'de=2031-01-01T00:00:00.000Z&ate=2031-12-31T23:59:59.000Z';

  let app: INestApplication;
  let prisma: PrismaService;
  let tecsus: string[];
  let licitacaoId: string;
  let vid: string;
  const idsBrutas = Array.from({ length: TOTAL }, () => randomUUID());
  const idsTrilha = Array.from({ length: TOTAL }, () => randomUUID());

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    ({ cookie: tecsus } = await criarSessaoDeTeste(app, 'ADMIN_TECSUS'));
    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    vid = `${PREFIXO_TESTE}stream-${Date.now()}`;

    // Uma instrução só para cada tabela: todas as linhas com o MESMO recebidoEm/criadoEm.
    await prisma.$executeRaw`
      INSERT INTO leituras_brutas (id, "vidEstacao", payload, localizacao, "unixtimeDispositivo", "recebidoEm")
      SELECT id, ${vid}, '{"chuva": 1}'::jsonb, ST_SetSRID(ST_MakePoint(0, 0), 4326), 1760000000, ${MOMENTO}::timestamp
      FROM unnest(${idsBrutas}::text[]) AS id`;
    await prisma.$executeRaw`
      INSERT INTO logs_auditoria (id, acao, entidade, "licitacaoId", "criadoEm")
      SELECT id, 'teste.streaming', 'Teste', ${licitacaoId}, ${MOMENTO}::timestamp
      FROM unnest(${idsTrilha}::text[]) AS id`;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  const linhasDe = (texto: string) => texto.replace(/^﻿/, '').split('\r\n').filter(Boolean);

  describe('leituras brutas', () => {
    const rota = () => `/leituras-brutas/exportar?${periodo}&vidEstacao=${encodeURIComponent(vid)}`;

    it('sai em partes (chunked), um lote por consulta, sem repetir nem perder linha', async () => {
      const consultas = jest.spyOn(prisma, '$queryRaw');
      consultas.mockClear();

      const resposta = await request(app.getHttpServer()).get(rota()).set('Cookie', tecsus).buffer(true).expect(200);

      expect(resposta.headers['content-type']).toContain('text/csv');
      expect(resposta.headers['transfer-encoding']).toBe('chunked');
      expect(resposta.headers['content-length']).toBeUndefined();
      const [cabecalho, ...linhas] = linhasDe(resposta.text);
      expect(cabecalho).toContain('ID da leitura');
      expect(linhas).toHaveLength(TOTAL);
      const exportados = linhas.map((linha) => linha.split(';')[0]);
      expect(new Set(exportados).size).toBe(TOTAL);
      expect(new Set(exportados)).toEqual(new Set(idsBrutas));
      // 1 consulta dos nomes das colunas de sensor + 3 lotes (2000 + 2000 + 500): o lote
      // parcial encerra, sem uma consulta a mais de conferência.
      expect(consultas).toHaveBeenCalledTimes(1 + 3);
      consultas.mockRestore();
    });

    it('um cliente lento (que pausa a leitura) ainda recebe o arquivo inteiro e íntegro', async () => {
      await app.listen(0);
      const cookie = tecsus[0].split(';')[0];
      const url = `${await app.getUrl()}${rota()}`;

      const { corpo, pausou } = await new Promise<{ corpo: string; pausou: boolean }>((resolver, rejeitar) => {
        http
          .get(url, { headers: { cookie } }, (res) => {
            const pedacos: Buffer[] = [];
            let pausou = false;
            res.on('data', (pedaco: Buffer) => {
              pedacos.push(pedaco);
              if (!pausou) {
                pausou = true;
                res.pause();
                setTimeout(() => res.resume(), 300);
              }
            });
            res.on('end', () => resolver({ corpo: Buffer.concat(pedacos).toString('utf8'), pausou }));
            res.on('error', rejeitar);
          })
          .on('error', rejeitar);
      });

      expect(pausou).toBe(true);
      expect(new Set(linhasDe(corpo).slice(1).map((linha) => linha.split(';')[0]))).toEqual(new Set(idsBrutas));
    }, 30_000);

    it('exige o período antes de começar o arquivo e não consulta o banco', async () => {
      const consultas = jest.spyOn(prisma, '$queryRaw');
      consultas.mockClear();

      const resposta = await request(app.getHttpServer()).get('/leituras-brutas/exportar').set('Cookie', tecsus).expect(400);

      expect(resposta.headers['content-type']).toContain('application/json');
      expect(consultas).not.toHaveBeenCalled();
      consultas.mockRestore();
    });
  });

  describe('trilha de auditoria', () => {
    const rota = () => `/auditoria/exportar?${periodo}&licitacaoId=${licitacaoId}`;

    it('sai em partes (chunked), um lote por consulta, sem repetir nem perder linha', async () => {
      const consultas = jest.spyOn(prisma.logAuditoria, 'findMany');
      consultas.mockClear();

      const resposta = await request(app.getHttpServer()).get(rota()).set('Cookie', tecsus).buffer(true).expect(200);

      expect(resposta.headers['transfer-encoding']).toBe('chunked');
      expect(resposta.headers['content-length']).toBeUndefined();
      const [cabecalho, ...linhas] = linhasDe(resposta.text);
      expect(cabecalho).toContain('Data/hora');
      expect(linhas).toHaveLength(TOTAL);
      expect(linhas.every((linha) => linha.includes('teste.streaming'))).toBe(true);
      expect(consultas).toHaveBeenCalledTimes(3);
      consultas.mockRestore();
    });

    it('a exportação é registrada na trilha, mas consultar a tela não', async () => {
      const exportacoes = () => prisma.logAuditoria.count({ where: { acao: 'auditoria.exportar' } });
      const antes = await exportacoes();

      await request(app.getHttpServer()).get(`/auditoria/exportar?${periodo}&licitacaoId=${licitacaoId}&acao=nada`).set('Cookie', tecsus).expect(200);
      await request(app.getHttpServer()).get(`/auditoria?licitacaoId=${licitacaoId}`).set('Cookie', tecsus).expect(200);
      await new Promise((resolver) => setTimeout(resolver, 100)); // o middleware grava no "finish" da resposta

      expect(await exportacoes()).toBe(antes + 1);
    });
  });
});
