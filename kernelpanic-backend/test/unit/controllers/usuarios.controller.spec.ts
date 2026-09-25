import { ForbiddenException } from '@nestjs/common';
import type { AuditoriaService } from '../../../src/auditoria/auditoria.service';
import type { PayloadJwt } from '../../../src/autenticacao/payload-jwt.interface';
import { UsuariosController } from '../../../src/usuarios/usuarios.controller';
import type { UsuariosService } from '../../../src/usuarios/usuarios.service';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  const usuariosServiceMock = {
    criar: jest.fn(),
    atualizar: jest.fn(),
    inativar: jest.fn(),
  };
  const auditoriaServiceMock = {
    registrar: jest.fn(),
  };

  const usuarioLogado: PayloadJwt = { sub: 'usuario-1', email: 'admin@a.com' };

  beforeEach(() => {
    jest.clearAllMocks();

    // Instancia direta, sem TestingModule: os @UseGuards() da controller
    // exigiriam resolver as dependências reais do GuardaJwt (AuthModuleOptions),
    // irrelevantes para testar os métodos isoladamente.
    controller = new UsuariosController(
      usuariosServiceMock as unknown as UsuariosService,
      auditoriaServiceMock as unknown as AuditoriaService,
    );
  });

  describe('inativar', () => {
    it('lança ForbiddenException quando o usuário tenta inativar a si mesmo', async () => {
      await expect(controller.inativar(usuarioLogado.sub, usuarioLogado)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(usuariosServiceMock.inativar).not.toHaveBeenCalled();
      expect(auditoriaServiceMock.registrar).not.toHaveBeenCalled();
    });

    it('inativa outro usuário e registra a auditoria', async () => {
      usuariosServiceMock.inativar.mockResolvedValue(undefined);

      const resposta = await controller.inativar('outro-usuario', usuarioLogado);

      expect(usuariosServiceMock.inativar).toHaveBeenCalledWith('outro-usuario');
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.inativar',
        entidade: 'Usuario',
        entidadeId: 'outro-usuario',
        usuarioId: usuarioLogado.sub,
      });
      expect(resposta.mensagem).toMatch(/inativado/);
    });
  });

  describe('criar', () => {
    it('cria o usuário e registra a auditoria com email e nome', async () => {
      const dto = { nome: 'Fulano', email: 'fulano@a.com', senha: 'senha12345' };
      usuariosServiceMock.criar.mockResolvedValue({ id: 'novo-id', ...dto, ativo: true });

      const resposta = await controller.criar(dto, usuarioLogado);

      expect(usuariosServiceMock.criar).toHaveBeenCalledWith(dto);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.criar',
        entidade: 'Usuario',
        entidadeId: 'novo-id',
        usuarioId: usuarioLogado.sub,
        detalhes: { email: dto.email, nome: dto.nome },
      });
      expect(resposta).toMatchObject({ id: 'novo-id', email: dto.email });
    });
  });

  describe('atualizar', () => {
    it('atualiza o usuário e registra a auditoria apenas com os campos informados', async () => {
      const dto = { nome: 'Novo Nome' };
      usuariosServiceMock.atualizar.mockResolvedValue({ id: 'outro-usuario', nome: 'Novo Nome', email: 'a@a.com', ativo: true });

      await controller.atualizar('outro-usuario', dto, usuarioLogado);

      expect(usuariosServiceMock.atualizar).toHaveBeenCalledWith('outro-usuario', dto);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.atualizar',
        entidade: 'Usuario',
        entidadeId: 'outro-usuario',
        usuarioId: usuarioLogado.sub,
        detalhes: { campos: ['nome'] },
      });
    });
  });
});
