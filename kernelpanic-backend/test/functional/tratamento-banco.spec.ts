import { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { LeiturasBrutasRepositorio } from '../../servicos/ingestao/leituras-brutas.repositorio';
import { TratamentoService } from '../../servicos/tratamento/tratamento.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real: o que a ingestão grava em leituras_brutas vira medida (com a
// licitação da estação), alarme ou leitura com erro quando o tratamento roda.
// A estação ativa, com o mesmo alerta da inativa, é o controle: sem ela o teste
// passaria mesmo que o trigger de alarmes nunca disparasse.
describe('Serviço de tratamento (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tratamento: TratamentoService;
  let repositorio: LeiturasBrutasRepositorio;
  let licitacaoId: string;
  let usuarioId: string;
  let tipoParametroId: string;
  let sequencia = 0;

  const criarEstacao = async (status: 'ATIVA' | 'INATIVA' = 'ATIVA') => {
    const vid = `${PREFIXO_TESTE}trat-${status.toLowerCase()}-${Date.now()}-${++sequencia}`;
    const estacao = await prisma.estacao.create({
      data: { nome: `${PREFIXO_TESTE}Estação ${status}`, endereco: 'Rua', vid, statusOperacional: status, usuarioId, licitacaoId },
    });
    const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId } });
    await prisma.alerta.create({
      data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 10, severidade: 'ALERTA', licitacaoId },
    });
    return { vid, estacaoId: estacao.id };
  };

  const gravarBruta = async (vid: string, leituras: Record<string, number>, unixtime = 1_760_000_000) => {
    const id = randomUUID();
    await repositorio.registrar([{ id, vidEstacao: vid, payload: leituras, latitude: 0, longitude: 0, unixtimeDispositivo: unixtime }]);
    return id;
  };

  /** Roda lotes até não sobrar nada pendente (outras specs também gravam leituras brutas). */
  const tratarTudo = async () => {
    while ((await tratamento.processarLote()).leituras > 0);
  };

  const contar = async (estacaoId: string) => {
    const [{ medidas, alarmes }] = await prisma.$queryRaw<{ medidas: bigint; alarmes: bigint }[]>`
      SELECT
        (SELECT count(*) FROM medidas WHERE "estacaoId" = ${estacaoId}) AS medidas,
        (SELECT count(*) FROM alarmes a JOIN medidas m ON m.id = a."medidaId" WHERE m."estacaoId" = ${estacaoId}) AS alarmes`;
    return { medidas: Number(medidas), alarmes: Number(alarmes) };
  };

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    repositorio = new LeiturasBrutasRepositorio(prisma);
    // Instância própria, sem o timer nem o LISTEN do bootstrap: o teste decide quando tratar.
    tratamento = new TratamentoService(prisma, { get: () => undefined } as unknown as ConfigService);
    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    usuarioId = (
      await prisma.usuario.create({
        data: { nome: 'Tratamento', email: emailDeTeste('tratamento'), senhaHash: 'x', tipo: 'ADMIN_TECSUS' },
      })
    ).id;
    tipoParametroId = (
      await prisma.tipoParametro.create({
        // o nome do sensor no payload casa com o nome do tipoParametro da estação
        data: { nome: 'chuva', unidade: 'mm', fator: 1, ganho: 0, valorMinimo: 0, valorMaximo: 500, licitacaoId },
      })
    ).id;
    await tratarTudo();
  });

  afterAll(async () => {
    await app.close();
  });

  it('estação ativa: grava a medida com a licitação da estação e dispara o alarme (controle)', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');
    await gravarBruta(vid, { chuva: 50 });

    await tratarTudo();

    expect(await contar(estacaoId)).toEqual({ medidas: 1, alarmes: 1 });
    const medida = await prisma.medida.findFirstOrThrow({ where: { estacaoId } });
    expect(medida).toMatchObject({ licitacaoId, valor: 50, unixtime: 1_760_000_000n });
  });

  it('estação inativa: o pacote fica só em leituras_brutas, sem medida nem alarme', async () => {
    const { vid, estacaoId } = await criarEstacao('INATIVA');
    const id = await gravarBruta(vid, { chuva: 50 });

    await tratarTudo();

    expect(await contar(estacaoId)).toEqual({ medidas: 0, alarmes: 0 });
    expect(await prisma.leituraErro.count({ where: { leituraBrutaId: id } })).toBe(0);
  });

  it('manda para leituras_erro só a leitura fora da faixa ou sem sensor, com a licitação, e grava o resto', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');
    const id = await gravarBruta(vid, { chuva: 900, vento: 3 }, 1_760_000_100);
    await gravarBruta(vid, { chuva: 5 }, 1_760_000_200);

    await tratarTudo();

    const erros = await prisma.leituraErro.findMany({ where: { leituraBrutaId: id }, orderBy: { nomeSensor: 'asc' } });
    expect(erros).toEqual([
      expect.objectContaining({ nomeSensor: 'chuva', motivo: 'ACIMA_DO_MAXIMO', valorMaximo: 500, licitacaoId }),
      expect.objectContaining({ nomeSensor: 'vento', motivo: 'SENSOR_NAO_CONFIGURADO', parametroId: null, licitacaoId }),
    ]);
    expect((await contar(estacaoId)).medidas).toBe(1);
  });

  it('vid sem estação: registra ESTACAO_NAO_CADASTRADA, sem licitação', async () => {
    const id = await gravarBruta(`${PREFIXO_TESTE}sem-estacao-${Date.now()}`, { chuva: 1 });

    await tratarTudo();

    expect(await prisma.leituraErro.findMany({ where: { leituraBrutaId: id } })).toEqual([
      expect.objectContaining({ motivo: 'ESTACAO_NAO_CADASTRADA', licitacaoId: null }),
    ]);
  });

  it('reenvio do mesmo instante não duplica medida nem alarme', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');
    await gravarBruta(vid, { chuva: 50 }, 1_760_000_300);
    await gravarBruta(vid, { chuva: 50 }, 1_760_000_300);

    await tratarTudo();

    expect(await contar(estacaoId)).toEqual({ medidas: 1, alarmes: 1 });
  });

  it('anda com o marcador: o que já foi tratado não é relido', async () => {
    const { vid } = await criarEstacao('ATIVA');
    const id = await gravarBruta(vid, { chuva: 1 }, 1_760_000_400);

    await tratarTudo();
    const controle = await prisma.controleTratamento.findUniqueOrThrow({ where: { id: 'leituras_brutas' } });

    expect(await tratamento.processarLote()).toEqual({ leituras: 0, medidas: 0, erros: 0 });
    // o marcador está no último lido ou depois dele (outras specs podem ter gravado depois)
    const [{ depois }] = await prisma.$queryRaw<{ depois: boolean }[]>`
      SELECT (${controle.ultimoXid}::bigint, ${controle.ultimaLeituraId}::text) >= ("xidTransacao", id) AS depois
      FROM leituras_brutas WHERE id = ${id}`;
    expect(depois).toBe(true);
  });

  it('não pula a leitura de uma transação que ainda não comitou, mesmo com leituras mais novas tratadas antes', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');
    const pendente = new Client({ connectionString: process.env.DATABASE_URL });
    await pendente.connect();
    try {
      // Transação aberta (como um lote da ingestão ainda gravando): o xid dela
      // é menor que o de tudo que for gravado e comitado depois.
      await pendente.query('BEGIN');
      await pendente.query(
        `INSERT INTO leituras_brutas (id, "vidEstacao", payload, localizacao, "unixtimeDispositivo")
         VALUES ($1, $2, '{"chuva": 20}'::jsonb, ST_SetSRID(ST_MakePoint(0, 0), 4326), 1760000500)`,
        [randomUUID(), vid],
      );
      await gravarBruta(vid, { chuva: 30 }, 1_760_000_600);

      await tratarTudo();
      expect((await contar(estacaoId)).medidas).toBe(0);

      await pendente.query('COMMIT');
      await tratarTudo();
      expect((await contar(estacaoId)).medidas).toBe(2);
    } finally {
      await pendente.end();
    }
  });
});
