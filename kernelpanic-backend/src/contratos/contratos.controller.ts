import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { AtualizarContratoDto } from './dto/atualizar-contrato.dto';
import { ContratoRespostaDto } from './dto/contrato-resposta.dto';
import { CriarContratoDto } from './dto/criar-contrato.dto';
import { ContratosService } from './contratos.service';

@Controller('contratos')
@UseGuards(GuardaJwt)
@ApiTags('contratos')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Cookie de sessão ausente ou inválido',
})
export class ContratosController {
  constructor(
    private readonly contratosService: ContratosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Consultar contrato por ID' })
  @ApiParam({ name: 'id', description: 'UUID do contrato' })
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
  async buscarPorId(
    @Param('id') id: string,
  ): Promise<ContratoRespostaDto> {
    const contrato = await this.contratosService.buscarPorId(id);
    return new ContratoRespostaDto(contrato);
  }

  @Post()
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Criar contrato',
    description:
      'Restrito ao administrador. Registra a operação na auditoria. Se o status for omitido, o contrato nasce como RASCUNHO.',
  })
  @ApiCreatedResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description:
      'Dados inválidos, vigência incoerente ou órgão inexistente/inativo',
  })
  @ApiConflictResponse({ description: 'Já existe um contrato com este número' })
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
    summary: 'Editar contrato',
    description:
      'Restrito ao administrador e auditado. Transições: RASCUNHO → VIGENTE/ENCERRADO; VIGENTE → SUSPENSO/ENCERRADO; SUSPENSO → VIGENTE/ENCERRADO. Contratos encerrados são imutáveis.',
  })
  @ApiParam({ name: 'id', description: 'UUID do contrato' })
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description:
      'Dados inválidos, vigência incoerente, órgão inativo, transição inválida ou contrato encerrado',
  })
  @ApiConflictResponse({ description: 'Já existe um contrato com este número' })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
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
    summary: 'Encerrar contrato',
    description:
      'Restrito ao administrador e auditado. Preserva o registro histórico, muda o status para ENCERRADO e grava a data do encerramento.',
  })
  @ApiParam({ name: 'id', description: 'UUID do contrato' })
  @ApiOkResponse({ type: ContratoRespostaDto })
  @ApiBadRequestResponse({
    description: 'Contrato já encerrado ou transição não permitida',
  })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
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
