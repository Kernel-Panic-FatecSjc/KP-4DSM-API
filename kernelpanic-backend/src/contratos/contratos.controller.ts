import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { ContratosService } from './contratos.service';
import { AtualizarContratoDto } from './dto/atualizar-contrato.dto';
import { ContratoRespostaDto } from './dto/contrato-resposta.dto';
import {
  ContratoListagemRespostaDto,
  ContratosPaginadosRespostaDto,
} from './dto/contrato-listagem-resposta.dto';
import { CriarContratoDto } from './dto/criar-contrato.dto';
import { ListarContratosQueryDto } from './dto/listar-contratos-query.dto';

const PARAMETRO_ID = { name: 'id', description: 'Id (UUID) do contrato' };

@ApiTags('contratos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sessao ausente ou invalida' })
@Controller('contratos')
@UseGuards(GuardaJwt)
export class ContratosController {
  constructor(
    private readonly contratosService: ContratosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar contratos e licitacoes cadastrados',
    description:
      'Listagem paginada (pagina/tamanho) com filtros por status do contrato e orgao e busca por numero (tambem considera objeto e nome do orgao). Cada item traz os dados do orgao e a quantidade de estacoes vinculadas (0 ate a US13 ser entregue).',
  })
  @ApiOkResponse({ type: ContratosPaginadosRespostaDto })
  @ApiBadRequestResponse({
    description: 'Filtros ou parametros de paginacao invalidos',
  })
  async listar(
    @Query() query: ListarContratosQueryDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ContratosPaginadosRespostaDto> {
    const { contratos, total, pagina, tamanho } =
      await this.contratosService.listar(query);
    await this.auditoriaService.registrar({
      acao: 'contratos.consultar',
      entidade: 'Contrato',
      usuarioId: usuario.sub,
      detalhes: { ...query },
    });
    return new ContratosPaginadosRespostaDto(
      contratos.map(
        (contrato) =>
          new ContratoListagemRespostaDto(contrato, contrato.quantidadeEstacoes),
      ),
      total,
      pagina,
      tamanho,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar contrato por id' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiNotFoundResponse({ description: 'Contrato nao encontrado' })
  async buscarPorId(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ContratoRespostaDto> {
    const contrato = await this.contratosService.buscarPorId(id);
    await this.auditoriaService.registrar({
      acao: 'contratos.consultar',
      entidade: 'Contrato',
      entidadeId: id,
      usuarioId: usuario.sub,
    });
    return new ContratoRespostaDto(contrato);
  }

  @Post()
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Criar contrato de licitacao',
    description:
      'Restrito ao administrador e registrado na auditoria. Valida numero unico, vigencia (fim >= inicio) e orgao existente e ativo.',
  })
  @ApiCreatedResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description:
      'Dados invalidos, vigencia incoerente, orgao inexistente/inativo ou status inicial nao permitido',
  })
  @ApiConflictResponse({ description: 'Ja existe um contrato com este numero' })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  async criar(
    @Body() dto: CriarContratoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ContratoRespostaDto> {
    const contrato = await this.contratosService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'contratos.criar',
      entidade: 'Contrato',
      entidadeId: contrato.id,
      usuarioId: usuario.sub,
      detalhes: {
        numero: dto.numero,
        orgaoId: dto.orgaoId,
        status: contrato.status,
      },
    });
    return new ContratoRespostaDto(contrato);
  }

  @Patch(':id')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Editar contrato de licitacao',
    description:
      'Restrito ao administrador e registrado na auditoria. Transicoes de status permitidas: RASCUNHO->ATIVO|ENCERRADO, ATIVO->SUSPENSO|ENCERRADO, SUSPENSO->ATIVO|ENCERRADO. Contrato encerrado nao pode ser alterado.',
  })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description:
      'Dados invalidos, vigencia incoerente, orgao inexistente/inativo, transicao nao permitida ou contrato encerrado',
  })
  @ApiConflictResponse({ description: 'Ja existe um contrato com este numero' })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({ description: 'Contrato nao encontrado' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarContratoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ContratoRespostaDto> {
    const contrato = await this.contratosService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'contratos.atualizar',
      entidade: 'Contrato',
      entidadeId: id,
      usuarioId: usuario.sub,
      detalhes: { campos: camposInformados(dto) },
    });
    return new ContratoRespostaDto(contrato);
  }

  @Patch(':id/encerrar')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Encerrar contrato sem exclusao fisica',
    description:
      'Restrito ao administrador e registrado na auditoria. O contrato nao e apagado: muda para ENCERRADO e preserva o historico.',
  })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description: 'Contrato ja encerrado ou transicao nao permitida',
  })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({ description: 'Contrato nao encontrado' })
  async encerrar(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ContratoRespostaDto> {
    const contrato = await this.contratosService.encerrar(id);
    await this.auditoriaService.registrar({
      acao: 'contratos.encerrar',
      entidade: 'Contrato',
      entidadeId: id,
      usuarioId: usuario.sub,
    });
    return new ContratoRespostaDto(contrato);
  }
}
