import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ESTACAO_COM_SENSORES, TIPO_CHUVA } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

const USUARIO = { id: 'usuario-1', email: 'user@teste.com', tipo: 'ADMINISTRADOR', ativo: true };

describe('Gerenciamento de estações (funcional)', () => {
  let app: INestApplication;
  let cookie: string;
  const usuario = { findUnique: jest.fn() };
  const estacao = { findUnique: jest.fn(), update: jest.fn() };
  const tipoParametro = { findMany: jest.fn() };
  const medida = { findFirst: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        estacao,
        tipoParametro,
        medida,
        logAuditoria,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });

    const jwt = app.get(JwtService);
    cookie = `access_token=${jwt.sign({ sub: USUARIO.id, email: USUARIO.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(USUARIO);
    estacao.findUnique.mockResolvedValue(ESTACAO_COM_SENSORES);
    // Como o Prisma, devolve os sensores do include mesmo quando o PATCH não mexe neles.
    estacao.update.mockImplementation(({ data: { parametros: _parametros, ...campos } }) => ({
      ...ESTACAO_COM_SENSORES,
      ...campos,
    }));
    medida.findFirst.mockResolvedValue(null);
    tipoParametro.findMany.mockImplementation(({ where }) =>
      where.id.in.map((id: string) => ({ id })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /estacoes/:id', () => {
    const remendar = (payload: object, comCookie = cookie) =>
      request(app.getHttpServer())
        .patch(`/estacoes/${ESTACAO_COM_SENSORES.id}`)
        .set('Cookie', comCookie)
        .send(payload);

    it('atualiza os dados e responde com a estação completa', async () => {
      const resposta = await remendar({ nome: 'Estação Norte', endereco: 'Av. B' }).expect(200);

      expect(resposta.body).toMatchObject({ id: ESTACAO_COM_SENSORES.id, nome: 'Estação Norte' });
      expect(resposta.body.sensores).toEqual([
        { id: TIPO_CHUVA, nome: 'Pluviômetro', unidade: 'mm' },
      ]);
    });

    it('registra a alteração na trilha de auditoria', async () => {
      await remendar({ nome: 'Estação Norte' }).expect(200);

      expect(logAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'estacoes.atualizar',
          entidade: 'Estacao',
          entidadeId: ESTACAO_COM_SENSORES.id,
          usuarioId: USUARIO.id,
          detalhes: { campos: ['nome'] },
        }),
      });
    });

    it('rejeita dados inválidos com 400 sem atualizar nem auditar', async () => {
      await remendar({ nome: '' }).expect(400);
      await remendar({ latitude: 120 }).expect(400);
      await remendar({ vid: 'nao-e-uuid-nem-mac' }).expect(400);
      await remendar({ statusOperacional: 'MANUTENCAO' }).expect(400);
      await remendar({ tipoParametroIds: [] }).expect(400);

      expect(estacao.update).not.toHaveBeenCalled();
      expect(logAuditoria.create).not.toHaveBeenCalled();
    });

    it('responde 404 quando a estação não existe', async () => {
      estacao.findUnique.mockResolvedValue(null);

      await remendar({ nome: 'x' }).expect(404);
      expect(estacao.update).not.toHaveBeenCalled();
    });

    it('responde 409 ao reaproveitar o vid de outra estação', async () => {
      estacao.findUnique
        .mockResolvedValueOnce(ESTACAO_COM_SENSORES)
        .mockResolvedValueOnce({ id: 'estacao-2' });

      await remendar({ vid: '11:22:33:44:55:66' }).expect(409);
      expect(estacao.update).not.toHaveBeenCalled();
    });

    it('responde 409 ao remover sensor que já tem medidas', async () => {
      medida.findFirst.mockResolvedValue({ parametroId: 'parametro-chuva' });

      await remendar({ tipoParametroIds: ['44444444-4444-4444-8444-444444444444'] }).expect(409);
      expect(estacao.update).not.toHaveBeenCalled();
    });

    it('recusa com 401 sem autenticação', async () => {
      await request(app.getHttpServer())
        .patch(`/estacoes/${ESTACAO_COM_SENSORES.id}`)
        .send({ nome: 'x' })
        .expect(401);
      expect(estacao.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /estacoes/:id', () => {
    const remover = () =>
      request(app.getHttpServer())
        .delete(`/estacoes/${ESTACAO_COM_SENSORES.id}`)
        .set('Cookie', cookie);

    it('inativa em vez de apagar e registra na auditoria', async () => {
      const resposta = await remover().expect(200);

      expect(resposta.body.mensagem).toMatch(/inativada/);
      expect(estacao.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { statusOperacional: 'INATIVA' } }),
      );
      expect(logAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'estacoes.inativar',
          entidade: 'Estacao',
          entidadeId: ESTACAO_COM_SENSORES.id,
          usuarioId: USUARIO.id,
        }),
      });
    });

    it('responde 404 quando a estação não existe', async () => {
      estacao.findUnique.mockResolvedValue(null);

      await remover().expect(404);
      expect(estacao.update).not.toHaveBeenCalled();
    });

    it('recusa com 401 sem autenticação', async () => {
      await request(app.getHttpServer())
        .delete(`/estacoes/${ESTACAO_COM_SENSORES.id}`)
        .expect(401);
    });
  });
});
