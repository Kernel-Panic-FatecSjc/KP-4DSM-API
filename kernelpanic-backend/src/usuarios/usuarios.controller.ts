import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { BuscarUsuariosQueryDto } from './dto/buscar-usuarios-query.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(GuardaJwt)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  async criar(@Body() dto: CriarUsuarioDto, @UsuarioAutenticado() usuarioLogado: PayloadJwt): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'usuarios.criar',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      usuarioId: usuarioLogado.sub,
      detalhes: { email: dto.email, nome: dto.nome },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Get()
  @UseGuards(GuardaAdministrador)
  async buscarTodos(@Query() query: BuscarUsuariosQueryDto): Promise<UsuarioRespostaDto[]> {
    const usuarios = await this.usuariosService.buscarTodos(query.busca);
    return usuarios.map((usuario) => new UsuarioRespostaDto(usuario));
  }

  @Get(':id')
  @UseGuards(GuardaAdministrador)
  async buscarPorId(@Param('id') id: string): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarPorId(id);
    return new UsuarioRespostaDto(usuario);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @UsuarioAutenticado() usuarioLogado: PayloadJwt,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'usuarios.atualizar',
      entidade: 'Usuario',
      entidadeId: id,
      usuarioId: usuarioLogado.sub,
      detalhes: { campos: camposInformados(dto) },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Delete(':id')
  async inativar(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: PayloadJwt): Promise<{ mensagem: string }> {
    if (id === usuarioLogado.sub) {
      throw new ForbiddenException('Não é possível inativar o próprio usuário');
    }
    await this.usuariosService.inativar(id);
    await this.auditoriaService.registrar({
      acao: 'usuarios.inativar',
      entidade: 'Usuario',
      entidadeId: id,
      usuarioId: usuarioLogado.sub,
    });
    return { mensagem: 'Usuário inativado com sucesso' };
  }
}
