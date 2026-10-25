import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TipoUsuario } from '../generated/prisma/client';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { camposInformados } from '../auditoria/campos-informados';
import { EstacaoRespostaDto } from '../estacoes/dto/estacao-resposta.dto';
import { EstacoesService } from '../estacoes/estacoes.service';
import { AtualizarLicitacaoDto } from './dto/atualizar-licitacao.dto';
import { CriarLicitacaoDto } from './dto/criar-licitacao.dto';
import { LicitacaoRespostaDto, LicitacoesPaginadasRespostaDto } from './dto/licitacao-resposta.dto';
import { ListarLicitacoesQueryDto } from './dto/listar-licitacoes-query.dto';
import { VincularEstacoesDto } from './dto/vincular-estacoes.dto';
import { LicitacoesService } from './licitacoes.service';

@Controller('licitacoes')
@UseGuards(GuardaJwt, GuardaPerfil)
@ApiTags('licitacoes')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Cookie de sessão ausente ou inválido' })
export class LicitacoesController {
  constructor(
    private readonly licitacoesService: LicitacoesService,
    private readonly estacoesService: EstacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // Sem auditoria explícita: o middleware de acesso já registra todo GET.
  @Get()
  @ApiOperation({
    summary: 'Listar licitações',
    description:
      'A Tecsus lista todas, com filtros e paginação; o usuário de licitação recebe só a própria. Busca por código, processo, contrato, objeto, órgão ou município.',
  })
  @ApiOkResponse({ type: LicitacoesPaginadasRespostaDto })
  async listar(
    @Query() query: ListarLicitacoesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<LicitacoesPaginadasRespostaDto> {
    const { itens, total, pagina, tamanho } = await this.licitacoesService.listar(query, usuario);
    return new LicitacoesPaginadasRespostaDto(
      itens.map((licitacao) => new LicitacaoRespostaDto(licitacao)),
      total,
      pagina,
      tamanho,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar licitação' })
  @ApiParam({ name: 'id', description: 'UUID da licitação' })
  @ApiOkResponse({ type: LicitacaoRespostaDto })
  @ApiForbiddenResponse({ description: 'Licitação de outro cliente' })
  @ApiNotFoundResponse({ description: 'Licitação não encontrada' })
  async buscarPorId(@Param('id') id: string, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<LicitacaoRespostaDto> {
    return new LicitacaoRespostaDto(await this.licitacoesService.buscarPorId(id, usuario));
  }

  @Get(':id/estacoes')
  @ApiOperation({ summary: 'Estações e sensores da licitação', description: 'Hierarquia licitação → estações → sensores.' })
  @ApiOkResponse({ type: EstacaoRespostaDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Licitação de outro cliente' })
  async listarEstacoes(@Param('id') id: string, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<EstacaoRespostaDto[]> {
    await this.licitacoesService.buscarPorId(id, usuario);
    const estacoes = await this.estacoesService.listarDaLicitacao(id);
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }

  @Post()
  @Perfis(TipoUsuario.ADMIN_TECSUS)
  @ApiOperation({
    summary: 'Cadastrar licitação',
    description: 'Restrito à Tecsus e auditado. Se o status for omitido, a licitação nasce como RASCUNHO.',
  })
  @ApiCreatedResponse({ type: LicitacaoRespostaDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou vigência incoerente' })
  @ApiConflictResponse({ description: 'Código, processo ou contrato já cadastrado' })
  @ApiForbiddenResponse({ description: 'Restrito à Tecsus' })
  async criar(@Body() dto: CriarLicitacaoDto, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<LicitacaoRespostaDto> {
    const licitacao = await this.licitacoesService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'licitacoes.criar',
      entidade: 'Licitacao',
      entidadeId: licitacao.id,
      ...autoria(usuario),
      detalhes: { codigoIdentificador: licitacao.codigoIdentificador, status: licitacao.status },
    });
    return new LicitacaoRespostaDto(licitacao);
  }

  @Patch(':id')
  @Perfis(TipoUsuario.ADMIN_TECSUS)
  @ApiOperation({
    summary: 'Editar licitação',
    description:
      'Restrito à Tecsus e auditado. Transições: RASCUNHO → VIGENTE; VIGENTE → SUSPENSA; SUSPENSA → VIGENTE. Encerrar tem rota própria; licitação encerrada é imutável.',
  })
  @ApiOkResponse({ type: LicitacaoRespostaDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos, transição inválida ou licitação encerrada' })
  @ApiConflictResponse({ description: 'Código, processo ou contrato já cadastrado' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarLicitacaoDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<LicitacaoRespostaDto> {
    const licitacao = await this.licitacoesService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'licitacoes.atualizar',
      entidade: 'Licitacao',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { campos: camposInformados(dto) },
    });
    return new LicitacaoRespostaDto(licitacao);
  }

  @Patch(':id/encerrar')
  @Perfis(TipoUsuario.ADMIN_TECSUS)
  @ApiOperation({
    summary: 'Encerrar licitação',
    description:
      'Restrito à Tecsus e auditado. Muda o status para ENCERRADA, inativa as estações e os alertas dela; os usuários passam a só ler.',
  })
  @ApiOkResponse({ type: LicitacaoRespostaDto })
  @ApiBadRequestResponse({ description: 'Licitação já encerrada' })
  async encerrar(@Param('id') id: string, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<LicitacaoRespostaDto> {
    const { licitacao, estacoesInativadas, alertasInativados } = await this.licitacoesService.encerrar(id);
    await this.auditoriaService.registrar({
      acao: 'licitacoes.encerrar',
      entidade: 'Licitacao',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { estacoesInativadas, alertasInativados },
    });
    return new LicitacaoRespostaDto(licitacao);
  }

  @Post(':id/estacoes')
  @Perfis(TipoUsuario.ADMIN_TECSUS)
  @ApiOperation({
    summary: 'Vincular (transferir) estações à licitação',
    description:
      'Restrito à Tecsus e auditado. A estação sai da licitação atual; os sensores passam a usar os tipos de mesmo nome do destino, e os alertas da origem são inativados.',
  })
  @ApiCreatedResponse({ schema: { example: { licitacaoId: 'uuid', estacoesVinculadas: 2, alertasInativados: 1 } } })
  @ApiBadRequestResponse({ description: 'Licitação encerrada, lista inválida ou sensores sem tipo no destino' })
  async vincularEstacoes(
    @Param('id') id: string,
    @Body() dto: VincularEstacoesDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ licitacaoId: string; estacoesVinculadas: number; alertasInativados: number }> {
    const resultado = await this.licitacoesService.vincularEstacoes(id, dto.estacaoIds);
    await this.auditoriaService.registrar({
      acao: 'licitacoes.estacoes.vincular',
      entidade: 'Licitacao',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { estacaoIds: dto.estacaoIds, alertasInativados: resultado.alertasInativados },
    });
    return { licitacaoId: id, ...resultado };
  }
}
