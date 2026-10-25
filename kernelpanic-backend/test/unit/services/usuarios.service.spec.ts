import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UsuariosService } from '../../../src/usuarios/usuarios.service';
import { ADMIN_A, ADMIN_B, LICITACAO_A, LICITACAO_B, TECSUS, USUARIO_A } from '../sessoes';

describe('UsuariosService', () => {
  let service: UsuariosService;
  const prismaMock = {
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    licitacao: {
      findUnique: jest.fn(),
    },
  };

  const comumDaA = { id: 'comum-a', email: 'c@a.com', tipo: 'USUARIO_LICITACAO', licitacaoId: LICITACAO_A, ativo: true };
  const adminDaA = { id: 'admin-a2', email: 'a2@a.com', tipo: 'ADMIN_LICITACAO', licitacaoId: LICITACAO_A, ativo: true };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.licitacao.findUnique.mockResolvedValue({ status: 'VIGENTE' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsuariosService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(UsuariosService);
  });

  describe('criar', () => {
    it('cria um usuário com a senha hasheada quando o email não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      prismaMock.usuario.create.mockImplementation(({ data }) => ({ id: '1', ...data }));

      const usuario = await service.criar({ nome: 'Fulano', email: 'a@a.com', senha: 'senha12345' }, ADMIN_A);

      expect(usuario.senhaHash).not.toBe('senha12345');
      expect(await bcrypt.compare('senha12345', usuario.senhaHash)).toBe(true);
    });

    it('lança ConflictException quando o email já existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });

      await expect(
        service.criar({ nome: 'Fulano', email: 'a@a.com', senha: 'senha12345' }, ADMIN_A),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    });

    it('o admin da licitação cria usuário comum na própria licitação, sem informá-la', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      prismaMock.usuario.create.mockImplementation(({ data }) => ({ id: '1', ...data }));

      const usuario = await service.criar({ nome: 'F', email: 'f@a.com', senha: 'senha12345' }, ADMIN_A);

      expect(usuario).toMatchObject({ tipo: 'USUARIO_LICITACAO', licitacaoId: LICITACAO_A });
    });

    it('o admin da licitação não cria outro admin', async () => {
      await expect(
        service.criar({ nome: 'F', email: 'f@a.com', senha: 'senha12345', tipo: 'ADMIN_LICITACAO' }, ADMIN_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('o admin da licitação não cria usuário em outra licitação', async () => {
      await expect(
        service.criar({ nome: 'F', email: 'f@a.com', senha: 'senha12345', licitacaoId: LICITACAO_B }, ADMIN_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a Tecsus precisa informar a licitação de um perfil de licitação', async () => {
      await expect(
        service.criar({ nome: 'F', email: 'f@a.com', senha: 'senha12345', tipo: 'ADMIN_LICITACAO' }, TECSUS),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a Tecsus não põe licitação num ADMIN_TECSUS', async () => {
      await expect(
        service.criar(
          { nome: 'F', email: 'f@a.com', senha: 'senha12345', tipo: 'ADMIN_TECSUS', licitacaoId: LICITACAO_A },
          TECSUS,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('licitação encerrada não recebe usuários novos', async () => {
      prismaMock.licitacao.findUnique.mockResolvedValue({ status: 'ENCERRADA' });

      await expect(
        service.criar(
          { nome: 'F', email: 'f@a.com', senha: 'senha12345', tipo: 'ADMIN_LICITACAO', licitacaoId: LICITACAO_A },
          TECSUS,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('buscarTodos', () => {
    it('prende o admin da licitação à dele', async () => {
      prismaMock.usuario.findMany.mockResolvedValue([]);

      await service.buscarTodos({}, ADMIN_A);

      expect(prismaMock.usuario.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });

    it('deixa a Tecsus ver todas ou filtrar uma', async () => {
      prismaMock.usuario.findMany.mockResolvedValue([]);

      await service.buscarTodos({}, TECSUS);
      await service.buscarTodos({ licitacaoId: LICITACAO_B }, TECSUS);

      expect(prismaMock.usuario.findMany.mock.calls[0][0].where.licitacaoId).toBeUndefined();
      expect(prismaMock.usuario.findMany.mock.calls[1][0].where.licitacaoId).toBe(LICITACAO_B);
    });
  });

  describe('buscarPorId', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna o usuário quando ele existe', async () => {
      const usuario = { id: '1', email: 'a@a.com' };
      prismaMock.usuario.findUnique.mockResolvedValue(usuario);

      await expect(service.buscarPorId('1')).resolves.toEqual(usuario);
    });
  });

  describe('atualizar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('inexistente', { nome: 'Novo' }, TECSUS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o novo email já pertence a outro usuário', async () => {
      prismaMock.usuario.findUnique
        .mockResolvedValueOnce({ id: '1', email: 'antigo@a.com' }) // buscarPorId
        .mockResolvedValueOnce({ id: '2', email: 'novo@a.com' }); // email já em uso

      await expect(service.atualizar('1', { email: 'novo@a.com' }, TECSUS)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('permite a cada um editar os próprios dados', async () => {
      prismaMock.usuario.findUnique
        .mockResolvedValueOnce({ id: USUARIO_A.sub, email: 'a@a.com', tipo: 'USUARIO_LICITACAO', licitacaoId: LICITACAO_A })
        .mockResolvedValueOnce({ id: USUARIO_A.sub, email: 'a@a.com' });
      prismaMock.usuario.update.mockResolvedValue({ id: USUARIO_A.sub });

      await service.atualizar(USUARIO_A.sub, { nome: 'Atualizado', email: 'a@a.com' }, USUARIO_A);

      expect(prismaMock.usuario.update.mock.calls[0][0].data).toMatchObject({ nome: 'Atualizado', email: 'a@a.com' });
    });

    it('o admin da licitação edita usuário comum dela, mas não outro admin nem usuário de outra', async () => {
      prismaMock.usuario.findUnique.mockResolvedValueOnce(comumDaA);
      prismaMock.usuario.update.mockResolvedValue(comumDaA);
      await expect(service.atualizar(comumDaA.id, { nome: 'X' }, ADMIN_A)).resolves.toBeDefined();

      prismaMock.usuario.findUnique.mockResolvedValueOnce(adminDaA);
      await expect(service.atualizar(adminDaA.id, { nome: 'X' }, ADMIN_A)).rejects.toBeInstanceOf(ForbiddenException);

      prismaMock.usuario.findUnique.mockResolvedValueOnce(comumDaA);
      await expect(service.atualizar(comumDaA.id, { nome: 'X' }, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('só a Tecsus muda perfil ou licitação', async () => {
      prismaMock.usuario.findUnique.mockResolvedValueOnce(comumDaA);

      await expect(
        service.atualizar(comumDaA.id, { tipo: 'ADMIN_LICITACAO' }, ADMIN_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a Tecsus promove o usuário a admin da licitação', async () => {
      prismaMock.usuario.findUnique.mockResolvedValueOnce(comumDaA);
      prismaMock.usuario.update.mockResolvedValue({ ...comumDaA, tipo: 'ADMIN_LICITACAO' });

      await service.atualizar(comumDaA.id, { tipo: 'ADMIN_LICITACAO' }, TECSUS);

      expect(prismaMock.usuario.update.mock.calls[0][0].data.tipo).toBe('ADMIN_LICITACAO');
    });
  });

  describe('inativar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.inativar('inexistente', TECSUS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('não deixa inativar o próprio usuário', async () => {
      await expect(service.inativar(TECSUS.sub, TECSUS)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marca o usuário como inativo em vez de apagá-lo', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(comumDaA);

      await service.inativar(comumDaA.id, ADMIN_A);

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: comumDaA.id },
        data: { ativo: false },
      });
    });

    it('o admin de outra licitação não inativa', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(comumDaA);

      await expect(service.inativar(comumDaA.id, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('ativar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.ativar('inexistente', TECSUS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('marca o usuário como ativo novamente', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ ...comumDaA, ativo: false });

      await service.ativar(comumDaA.id, TECSUS);

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: comumDaA.id },
        data: { ativo: true },
      });
    });
  });
});
