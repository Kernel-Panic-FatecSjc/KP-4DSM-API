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
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import {
  ChaveIngestaoRespostaDto,
  EstacaoCriadaRespostaDto,
  EstacaoRespostaDto,
  ListaEstacoesRespostaDto,
} from './dto/estacao-resposta.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';
import { EstacoesService } from './estacoes.service';

const PARAMETRO_ID = { name: 'id', description: 'Identificador (UUID) da estação.', example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' };

@ApiTags('estacoes')
@Controller('estacoes')
@UseGuards(GuardaJwt, GuardaPerfil)
@RotaLogada()
export class EstacoesController {
  constructor(
    private readonly estacoesService: EstacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar estações',
    description: 'Paginada, com filtros. Usuário de licitação vê só as da própria licitação. A consulta é registrada na auditoria.',
  })
  @ApiOkResponse({ type: ListaEstacoesRespostaDto, description: 'Página de estações.' })
  @RequisicaoInvalida('Filtro ou paginação inválidos.')
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
  @ApiOperation({ summary: 'Buscar estação por id', description: 'Com sensores e licitação.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: EstacaoRespostaDto, description: 'Estação encontrada.' })
  @NaoEncontrado('Estação inexistente ou fora do escopo do chamador.')
  async buscar(@Param('id') id: string, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<EstacaoRespostaDto> {
    return new EstacaoRespostaDto(await this.estacoesService.buscar(id, usuario));
  }

  // A resposta traz a chave de ingestão da estação: só os admins cadastram.
  @Post()
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({
    summary: 'Cadastrar estação',
    description: 'Gera a chave de ingestão da estação e a devolve uma única vez. Licitação encerrada não recebe estações.',
  })
  @ApiCreatedResponse({ type: EstacaoCriadaRespostaDto, description: 'Estação cadastrada, com a chave de ingestão.' })
  @RequisicaoInvalida('Dados inválidos, licitação ausente, inexistente ou encerrada, ou sensores inválidos.')
  @Proibido('Perfil sem permissão.')
  @Conflito('Já existe uma estação com este identificador (vid).')
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
  @ApiOperation({ summary: 'Gerar nova chave de ingestão', description: 'A chave anterior deixa de valer. A nova é devolvida uma única vez.' })
  @ApiParam(PARAMETRO_ID)
  @ApiCreatedResponse({ type: ChaveIngestaoRespostaDto, description: 'Nova chave de ingestão.' })
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Estação inexistente ou fora do escopo do chamador.')
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
  @ApiOperation({ summary: 'Atualizar estação', description: 'Dados, status operacional e lista de sensores.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: EstacaoRespostaDto, description: 'Estação atualizada.' })
  @RequisicaoInvalida('Dados inválidos ou sensores inválidos.')
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Estação inexistente ou fora do escopo do chamador.')
  @Conflito('Identificador (vid) já usado por outra estação, ou sensor com medidas que não pode ser removido.')
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
  @ApiOperation({ summary: 'Inativar estação', description: 'Marca a estação como INATIVA (não apaga). O histórico de medidas é mantido.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Estação inativada.' })
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Estação inexistente ou fora do escopo do chamador.')
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
