import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { camposInformados } from '../auditoria/campos-informados';
import { Conflito, MensagemRespostaDto, NaoEncontrado, Proibido, RequisicaoInvalida, RotaLogada } from '../documentacao/respostas';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { BuscarUsuariosQueryDto } from './dto/buscar-usuarios-query.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { UsuariosService } from './usuarios.service';

const PARAMETRO_ID = { name: 'id', description: 'Identificador (UUID) do usuário.', example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d' };

@ApiTags('usuarios')
@Controller('usuarios')
@UseGuards(GuardaJwt, GuardaPerfil)
@RotaLogada()
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({
    summary: 'Cadastrar usuário',
    description: 'Tecsus cadastra em qualquer licitação; o admin da licitação só cadastra usuários comuns, na própria licitação. Licitação encerrada não recebe usuários novos.',
  })
  @ApiCreatedResponse({ type: UsuarioRespostaDto, description: 'Usuário cadastrado.' })
  @RequisicaoInvalida('Dados inválidos, licitação ausente, inexistente ou encerrada.')
  @Proibido('Perfil sem permissão ou tentativa de cadastrar perfil que o chamador não pode criar.')
  @Conflito('Já existe um usuário com este email.')
  async criar(@Body() dto: CriarUsuarioDto, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.criar(dto, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.criar',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      ...autoria(usuarioLogado),
      detalhes: { email: dto.email, nome: dto.nome, tipo: usuario.tipo, licitacaoId: usuario.licitacaoId },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Get()
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({
    summary: 'Listar usuários',
    description: 'Tecsus vê todos (ou os de uma licitação); o admin da licitação vê só os da própria licitação.',
  })
  @ApiOkResponse({ type: UsuarioRespostaDto, isArray: true, description: 'Usuários que o chamador pode ver.' })
  @RequisicaoInvalida('Filtro inválido.')
  @Proibido('Perfil sem permissão.')
  async buscarTodos(
    @Query() query: BuscarUsuariosQueryDto,
    @UsuarioAutenticado() usuarioLogado: UsuarioLogado,
  ): Promise<UsuarioRespostaDto[]> {
    const usuarios = await this.usuariosService.buscarTodos(query, usuarioLogado);
    return usuarios.map((usuario) => new UsuarioRespostaDto(usuario));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por id', description: 'Só devolve usuários que o chamador pode ver.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: UsuarioRespostaDto, description: 'Usuário encontrado.' })
  @NaoEncontrado('Usuário inexistente ou fora do escopo do chamador.')
  async buscarPorId(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarVisivel(id, usuarioLogado);
    return new UsuarioRespostaDto(usuario);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar usuário',
    description: 'Qualquer usuário edita os próprios dados; perfil e licitação só a Tecsus muda, e nunca o próprio perfil.',
  })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: UsuarioRespostaDto, description: 'Usuário atualizado.' })
  @RequisicaoInvalida('Dados inválidos.')
  @Proibido('Sem permissão para gerenciar este usuário ou para mudar perfil/licitação.')
  @NaoEncontrado('Usuário inexistente ou fora do escopo do chamador.')
  @Conflito('Já existe um usuário com este email.')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @UsuarioAutenticado() usuarioLogado: UsuarioLogado,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.atualizar(id, dto, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.atualizar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
      detalhes: { campos: camposInformados(dto) },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Delete(':id')
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({ summary: 'Inativar usuário', description: 'Inativa o usuário (não apaga). Não é possível inativar o próprio usuário.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Usuário inativado.' })
  @Proibido('Perfil sem permissão, usuário fora do escopo ou tentativa de inativar o próprio usuário.')
  @NaoEncontrado('Usuário inexistente.')
  async inativar(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<{ mensagem: string }> {
    await this.usuariosService.inativar(id, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.inativar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
    });
    return { mensagem: 'Usuário inativado com sucesso' };
  }

  @Patch(':id/ativar')
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({ summary: 'Reativar usuário', description: 'Reativa um usuário inativado.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Usuário reativado.' })
  @Proibido('Perfil sem permissão ou usuário fora do escopo do chamador.')
  @NaoEncontrado('Usuário inexistente.')
  async ativar(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<{ mensagem: string }> {
    await this.usuariosService.ativar(id, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.ativar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
    });
    return { mensagem: 'Usuário ativado com sucesso' };
  }
}
