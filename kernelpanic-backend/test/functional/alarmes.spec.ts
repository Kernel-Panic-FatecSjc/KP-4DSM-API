import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ALARME_COM_RELACOES, LICITACAO_FIXTURE } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

const MONITOR = { id: 'monitor-1', email: 'monitor@teste.com', tipo: 'USUARIO_LICITACAO', licitacaoId: LICITACAO_FIXTURE, licitacao: { status: 'VIGENTE' }, ativo: true };

describe('Tratamento de alarmes (funcional)', () => {
  let app: INestApplication;
  let cookie: string;
  const usuario = { findUnique: jest.fn() };
  const alarme = { findUnique: jest.fn(), update: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, alarme, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() },
    });

    const jwt = app.get(JwtService);
    cookie = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(MONITOR);
    alarme.findUnique.mockResolvedValue({ status: 'ABERTO', alerta: { licitacaoId: LICITACAO_FIXTURE } });
    alarme.update.mockImplementation(({ data }) => ({ ...ALARME_COM_RELACOES, ...data }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('nega mudar o status de alarme de outra licitação', async () => {
    alarme.findUnique.mockResolvedValue({ status: 'ABERTO', alerta: { licitacaoId: 'outra-licitacao' } });

    await remendar({ status: 'RECONHECIDO' }).expect(403);
    expect(alarme.update).not.toHaveBeenCalled();
  });

  it('nega a escrita quando a licitação do usuário não está vigente', async () => {
    usuario.findUnique.mockResolvedValue({ ...MONITOR, licitacao: { status: 'ENCERRADA' } });

    await remendar({ status: 'RECONHECIDO' }).expect(403);
    expect(alarme.update).not.toHaveBeenCalled();
  });

  const remendar = (payload: object, comCookie = cookie) =>
    request(app.getHttpServer())
      .patch(`/alarmes/${ALARME_COM_RELACOES.id}`)
      .set('Cookie', comCookie)
      .send(payload);

  it('reconhece um alarme aberto e devolve o histórico atualizado', async () => {
    const resposta = await remendar({ status: 'RECONHECIDO' }).expect(200);

    expect(resposta.body).toMatchObject({
      id: ALARME_COM_RELACOES.id,
      status: 'RECONHECIDO',
      valorMedido: 42,
      severidade: 'EMERGENCIA',
    });
  });

  it('registra a transição na trilha de auditoria', async () => {
    await remendar({ status: 'RESOLVIDO' }).expect(200);

    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'alarmes.atualizarStatus',
        entidade: 'Alarme',
        entidadeId: ALARME_COM_RELACOES.id,
        usuarioId: MONITOR.id,
        detalhes: { status: 'RESOLVIDO' },
      }),
    });
  });

  it('rejeita status fora do enum com 400', async () => {
    await remendar({}).expect(400);
    await remendar({ status: 'FECHADO' }).expect(400);

    expect(alarme.update).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalled();
  });

  it('responde 409 ao tentar reabrir um alarme já resolvido', async () => {
    alarme.findUnique.mockResolvedValue({ status: 'RESOLVIDO', alerta: { licitacaoId: LICITACAO_FIXTURE } });

    await remendar({ status: 'ABERTO' }).expect(409);
    expect(alarme.update).not.toHaveBeenCalled();
  });

  it('responde 404 quando o alarme não existe', async () => {
    alarme.findUnique.mockResolvedValue(null);

    await remendar({ status: 'RECONHECIDO' }).expect(404);
  });

  it('recusa com 401 sem autenticação', async () => {
    await request(app.getHttpServer())
      .patch(`/alarmes/${ALARME_COM_RELACOES.id}`)
      .send({ status: 'RECONHECIDO' })
      .expect(401);
    expect(alarme.update).not.toHaveBeenCalled();
  });
});
