import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { EVENTO_NOVOS_ALARMES, EVENTO_REGIAO } from '../../src/alarmes/tempo-real/alarmes.gateway';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

interface AlarmeRecebido {
  id: string;
  valorMedido: number;
  severidade: string;
  estacao: { nome: string };
}

// Estação em São José dos Campos/SP.
const POSICAO_ESTACAO = { latitude: -23.1627, longitude: -45.7953 };
// Taubaté (~40 km da estação) e Manaus (~2.700 km).
const PERTO = { latitude: -23.0264, longitude: -45.5553 };
const LONGE = { latitude: -3.119, longitude: -60.0217 };

// Ponta a ponta com o banco real: inserir uma medida acima do limite faz o
// trigger criar o alarme e notificar (pg_notify), e o websocket repassa a
// quem está logado e aos visitantes a até 100 km da estação.
describe('Alarmes em tempo real (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  let parametroId: string;
  let estacaoId: string;
  let cookieAdmin: string;
  const clientes: Socket[] = [];
  const valorOriginal = process.env.ALARMES_TEMPO_REAL;

  async function conectar(opcoes: { regiao?: typeof PERTO; cookie?: string } = {}): Promise<Socket> {
    const cliente = io(url, {
      transports: ['websocket'],
      extraHeaders: opcoes.cookie ? { cookie: opcoes.cookie } : undefined,
    });
    clientes.push(cliente);
    await new Promise<void>((resolve) => cliente.on('connect', resolve));
    if (opcoes.regiao) {
      const resposta = await cliente.emitWithAck(EVENTO_REGIAO, opcoes.regiao);
      expect(resposta).toEqual({ ok: true });
    }
    return cliente;
  }

  function aguardarAlarmes(cliente: Socket): Promise<AlarmeRecebido[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Nenhum alarme recebido pelo websocket')), 5000);
      cliente.once(EVENTO_NOVOS_ALARMES, (alarmes: AlarmeRecebido[]) => {
        clearTimeout(timer);
        resolve(alarmes);
      });
    });
  }

  function espiar(cliente: Socket): jest.Mock {
    const espiao = jest.fn();
    cliente.on(EVENTO_NOVOS_ALARMES, espiao);
    return espiao;
  }

  function dispararMedida(valor: number, unixtime: bigint) {
    return prisma.medida.create({ data: { valor, unixtime, parametroId, estacaoId } });
  }

  beforeAll(async () => {
    process.env.ALARMES_TEMPO_REAL = 'true';
    app = await criarAppDeTeste();
    await app.listen(0);
    prisma = app.get(PrismaService);

    const usuario = await prisma.usuario.create({
      data: { nome: 'Tempo real', email: emailDeTeste('tempo-real'), senhaHash: 'x' },
    });
    cookieAdmin = `access_token=${app.get(JwtService).sign({ sub: usuario.id, email: usuario.email })}`;
    const tipo = await prisma.tipoParametro.create({
      data: { nome: `${PREFIXO_TESTE}chuva`, unidade: 'mm', fator: 1, ganho: 0 },
    });
    const estacao = await prisma.estacao.create({
      data: {
        nome: `${PREFIXO_TESTE}Estação tempo real`,
        endereco: 'Rua de teste',
        vid: `${PREFIXO_TESTE}${Date.now()}`,
        usuarioId: usuario.id,
        ...POSICAO_ESTACAO,
      },
    });
    const parametro = await prisma.parametro.create({
      data: { estacaoId: estacao.id, tipoParametroId: tipo.id },
    });
    await prisma.alerta.create({
      data: { operador: 'MAIOR_QUE', valorLimite: 50, severidade: 'EMERGENCIA', parametroId: parametro.id },
    });
    estacaoId = estacao.id;
    parametroId = parametro.id;

    const { port } = app.getHttpServer().address();
    url = `http://localhost:${port}/alarmes`;
  });

  afterAll(async () => {
    for (const cliente of clientes) cliente.disconnect();
    await app.close();
    process.env.ALARMES_TEMPO_REAL = valorOriginal;
  });

  it('entrega só a quem está perto da estação ou logado', async () => {
    const perto = await conectar({ regiao: PERTO });
    const admin = await conectar({ cookie: cookieAdmin });
    const espiaoLonge = espiar(await conectar({ regiao: LONGE }));
    const espiaoSemRegiao = espiar(await conectar());

    const recebidosPerto = aguardarAlarmes(perto);
    const recebidosAdmin = aguardarAlarmes(admin);
    await dispararMedida(80, 1_760_000_000n);

    const [alarmesPerto, alarmesAdmin] = await Promise.all([recebidosPerto, recebidosAdmin]);
    expect(alarmesPerto).toHaveLength(1);
    expect(alarmesPerto[0]).toMatchObject({
      valorMedido: 80,
      severidade: 'EMERGENCIA',
      estacao: { nome: `${PREFIXO_TESTE}Estação tempo real` },
    });
    expect(alarmesAdmin).toEqual(alarmesPerto);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(espiaoLonge).not.toHaveBeenCalled();
    expect(espiaoSemRegiao).not.toHaveBeenCalled();
  });

  it('não reenvia alarmes já emitidos no próximo disparo', async () => {
    const perto = await conectar({ regiao: PERTO });
    const recebidos = aguardarAlarmes(perto);
    await dispararMedida(90, 1_760_000_060n);

    const alarmes = await recebidos;
    expect(alarmes).toHaveLength(1);
    expect(alarmes[0].valorMedido).toBe(90);
  });

  it('não emite nada para medidas dentro do limite', async () => {
    const espiao = espiar(await conectar({ regiao: PERTO }));
    await dispararMedida(10, 1_760_000_120n);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(espiao).not.toHaveBeenCalled();
  });

  it('filtra o histórico do visitante pela distância real (PostGIS)', async () => {
    const consultar = (regiao: typeof PERTO) =>
      request(app.getHttpServer())
        .get(`/alarmes?latitude=${regiao.latitude}&longitude=${regiao.longitude}&estacaoId=${estacaoId}`)
        .expect(200);

    expect((await consultar(PERTO)).body.total).toBeGreaterThan(0);
    expect((await consultar(LONGE)).body.total).toBe(0);
  });

  it('lista nos filtros do visitante só as estações do raio', async () => {
    const nomes = async (regiao: typeof PERTO) => {
      const resposta = await request(app.getHttpServer())
        .get(`/alertas/filtros?latitude=${regiao.latitude}&longitude=${regiao.longitude}`)
        .expect(200);
      return resposta.body.estacoes.map((estacao: { nome: string }) => estacao.nome);
    };

    expect(await nomes(PERTO)).toContain(`${PREFIXO_TESTE}Estação tempo real`);
    expect(await nomes(LONGE)).not.toContain(`${PREFIXO_TESTE}Estação tempo real`);
  });

  it('recusa uma região inválida', async () => {
    const cliente = await conectar();
    await expect(cliente.emitWithAck(EVENTO_REGIAO, { latitude: 200, longitude: 0 })).resolves.toEqual({ ok: false });
  });
});
