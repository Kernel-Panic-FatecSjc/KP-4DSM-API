import type { AuditoriaService } from '../../../src/auditoria/auditoria.service';
import { UsuariosController } from '../../../src/usuarios/usuarios.controller';
import type { UsuariosService } from '../../../src/usuarios/usuarios.service';
import { ADMIN_A, LICITACAO_A, TECSUS } from '../sessoes';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  const usuariosServiceMock = {
    criar: jest.fn(),
    atualizar: jest.fn(),
    inativar: jest.fn(),
    ativar: jest.fn(),
  };
  const auditoriaServiceMock = {
    registrar: jest.fn(),
  };

  const usuarioCriado = {
    id: 'novo-id',
    nome: 'Fulano',
    email: 'fulano@a.com',
    tipo: 'USUARIO_LICITACAO',
    ativo: true,
    licitacaoId: LICITACAO_A,
    licitacao: { id: LICITACAO_A, codigoIdentificador: 'A', orgaoNome: 'Órgão A', status: 'VIGENTE' },
  };

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
    it('inativa pelo serviço (que confere a permissão) e audita com a licitação do autor', async () => {
      usuariosServiceMock.inativar.mockResolvedValue(undefined);

      const resposta = await controller.inativar('outro-usuario', ADMIN_A);

      expect(usuariosServiceMock.inativar).toHaveBeenCalledWith('outro-usuario', ADMIN_A);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.inativar',
        entidade: 'Usuario',
        entidadeId: 'outro-usuario',
        usuarioId: ADMIN_A.sub,
        licitacaoId: LICITACAO_A,
      });
      expect(resposta.mensagem).toMatch(/inativado/);
    });

    it('não audita quando o serviço recusa', async () => {
      usuariosServiceMock.inativar.mockRejectedValue(new Error('recusado'));

      await expect(controller.inativar('x', ADMIN_A)).rejects.toThrow('recusado');
      expect(auditoriaServiceMock.registrar).not.toHaveBeenCalled();
    });
  });

  describe('ativar', () => {
    it('reativa o usuário e registra a auditoria como ação da Tecsus (licitação nula)', async () => {
      usuariosServiceMock.ativar.mockResolvedValue(undefined);

      const resposta = await controller.ativar('outro-usuario', TECSUS);

      expect(usuariosServiceMock.ativar).toHaveBeenCalledWith('outro-usuario', TECSUS);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.ativar',
        entidade: 'Usuario',
        entidadeId: 'outro-usuario',
        usuarioId: TECSUS.sub,
        licitacaoId: null,
      });
      expect(resposta.mensagem).toMatch(/ativado/);
    });
  });

  describe('criar', () => {
    it('cria o usuário e registra a auditoria com email, nome, perfil e licitação', async () => {
      const dto = { nome: 'Fulano', email: 'fulano@a.com', senha: 'senha12345' };
      usuariosServiceMock.criar.mockResolvedValue(usuarioCriado);

      const resposta = await controller.criar(dto, ADMIN_A);

      expect(usuariosServiceMock.criar).toHaveBeenCalledWith(dto, ADMIN_A);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.criar',
        entidade: 'Usuario',
        entidadeId: 'novo-id',
        usuarioId: ADMIN_A.sub,
        licitacaoId: LICITACAO_A,
        detalhes: { email: dto.email, nome: dto.nome, tipo: 'USUARIO_LICITACAO', licitacaoId: LICITACAO_A },
      });
      expect(resposta).toMatchObject({ id: 'novo-id', email: dto.email, licitacao: { id: LICITACAO_A } });
    });
  });

  describe('atualizar', () => {
    it('atualiza o usuário e registra a auditoria apenas com os campos informados', async () => {
      const dto = { nome: 'Novo Nome' };
      usuariosServiceMock.atualizar.mockResolvedValue({ ...usuarioCriado, nome: 'Novo Nome' });

      await controller.atualizar('outro-usuario', dto, TECSUS);

      expect(usuariosServiceMock.atualizar).toHaveBeenCalledWith('outro-usuario', dto, TECSUS);
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith({
        acao: 'usuarios.atualizar',
        entidade: 'Usuario',
        entidadeId: 'outro-usuario',
        usuarioId: TECSUS.sub,
        licitacaoId: null,
        detalhes: { campos: ['nome'] },
      });
    });
  });
});
