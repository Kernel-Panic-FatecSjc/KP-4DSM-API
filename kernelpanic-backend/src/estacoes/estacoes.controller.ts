import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { camposInformados } from '../auditoria/campos-informados';
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { EstacaoCriadaRespostaDto, EstacaoRespostaDto, ListaEstacoesRespostaDto } from './dto/estacao-resposta.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';
import { EstacoesService } from './estacoes.service';

@Controller('estacoes')
@UseGuards(GuardaJwt, GuardaPerfil)
export class EstacoesController {
  constructor(
    private readonly estacoesService: EstacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarEstacoesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<ListaEstacoesRespostaDto> {
    const { itens, total, pagina, tamanho } = await this.estacoesService.listar(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'estacoes.consultar',
      entidade: 'Estacao',
      ...autoria(usuario),
      detalhes: { ...query },
    });
    return new ListaEstacoesRespostaDto(itens.map((estacao) => new EstacaoRespostaDto(estacao)), total, pagina, tamanho);
  }

  @Get(':id')
  async buscar(@Param('id') id: string, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<EstacaoRespostaDto> {
    return new EstacaoRespostaDto(await this.estacoesService.buscar(id, usuario));
  }

  // A resposta traz a chave de ingestão da estação: só os admins cadastram.
  @Post()
  @Perfis(...PERFIS_ADMIN)
  async criar(
    @Body() dto: CriarEstacaoDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<EstacaoCriadaRespostaDto> {
    const { estacao, chaveIngestao } = await this.estacoesService.criar(dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'estacoes.criar',
      entidade: 'Estacao',
      entidadeId: estacao.id,
      ...autoria(usuario),
      detalhes: { nome: dto.nome, vid: dto.vid, licitacaoId: estacao.licitacaoId, tipoParametroIds: dto.tipoParametroIds },
    });
    return new EstacaoCriadaRespostaDto(estacao, chaveIngestao);
  }

  // A chave nova não vai para a auditoria: só o registro de que foi trocada.
  @Post(':id/chave-ingestao')
  @Perfis(...PERFIS_ADMIN)
  async regenerarChaveIngestao(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ chaveIngestao: string }> {
    const chaveIngestao = await this.estacoesService.regenerarChaveIngestao(id, usuario);
    await this.auditoriaService.registrar({
      acao: 'estacoes.regenerarChaveIngestao',
      entidade: 'Estacao',
      entidadeId: id,
      ...autoria(usuario),
    });
    return { chaveIngestao };
  }

  @Patch(':id')
  @Perfis(...PERFIS_ADMIN)
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarEstacaoDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<EstacaoRespostaDto> {
    const estacao = await this.estacoesService.atualizar(id, dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'estacoes.atualizar',
      entidade: 'Estacao',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { campos: camposInformados(dto) },
    });
    return new EstacaoRespostaDto(estacao);
  }

  @Delete(':id')
  @Perfis(...PERFIS_ADMIN)
  async inativar(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ mensagem: string }> {
    await this.estacoesService.inativar(id, usuario);
    await this.auditoriaService.registrar({
      acao: 'estacoes.inativar',
      entidade: 'Estacao',
      entidadeId: id,
      ...autoria(usuario),
    });
    return { mensagem: 'Estação inativada com sucesso' };
  }
}
