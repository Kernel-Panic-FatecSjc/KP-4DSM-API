import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EstacaoRespostaDto } from './dto/estacao-resposta.dto';
import { VincularEstacoesContratoDto } from './dto/vincular-estacoes-contrato.dto';
import { EstacoesService } from './estacoes.service';

// Sem auditoria explícita: o middleware de acesso já registra todo GET.
@ApiTags('contratos')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Cookie de sessão ausente ou inválido',
})
@Controller()
@UseGuards(GuardaJwt)
export class ContratoEstacoesController {
  constructor(
    private readonly estacoesService: EstacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get('contratos/:id/estacoes')
  @ApiOperation({
    summary: 'Lista estações e sensores de um contrato',
    description:
      'Retorna a hierarquia contrato → estações → sensores configurados.',
  })
  @ApiOkResponse({ type: EstacaoRespostaDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
  async listar(@Param('id') contratoId: string): Promise<EstacaoRespostaDto[]> {
    const estacoes = await this.estacoesService.listarPorContrato(contratoId);
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }

  @Post('contratos/:id/estacoes')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Vincula estações a um contrato vigente',
    description:
      'Associa uma ou mais estações ativas e ainda não vinculadas a outro contrato. Restrito ao administrador e auditado.',
  })
  @ApiCreatedResponse({
    description: 'Quantidade de estações vinculadas ao contrato',
    schema: {
      example: { contratoId: 'uuid', estacoesVinculadas: 2 },
    },
  })
  @ApiBadRequestResponse({
    description: 'Contrato não vigente, estação inativa ou lista inválida',
  })
  @ApiConflictResponse({
    description: 'Uma estação já está vinculada a outro contrato',
  })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({
    description: 'Contrato ou uma das estações não encontrado',
  })
  async vincular(
    @Param('id') contratoId: string,
    @Body() dto: VincularEstacoesContratoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<{ contratoId: string; estacoesVinculadas: number }> {
    const quantidade = await this.estacoesService.vincularAoContrato(
      contratoId,
      dto.estacaoIds,
    );
    await this.auditoriaService.registrar({
      acao: 'contratos.estacoes.vincular',
      entidade: 'Contrato',
      entidadeId: contratoId,
      usuarioId: usuario.sub,
      detalhes: { estacaoIds: dto.estacaoIds },
    });
    return { contratoId, estacoesVinculadas: quantidade };
  }

  @Delete('contratos/:id/estacoes/:estacaoId')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Desvincula uma estação de um contrato',
    description:
      'Remove a associação da estação com o contrato. Restrito ao administrador e auditado.',
  })
  @ApiOkResponse({
    description: 'Estação desvinculada do contrato',
    schema: {
      example: { contratoId: 'uuid', estacaoId: 'uuid' },
    },
  })
  @ApiConflictResponse({
    description: 'A estação está vinculada a outro contrato',
  })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  @ApiNotFoundResponse({
    description: 'Contrato, estação ou vínculo não encontrado',
  })
  async desvincular(
    @Param('id') contratoId: string,
    @Param('estacaoId') estacaoId: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<{ contratoId: string; estacaoId: string }> {
    await this.estacoesService.desvincularDoContrato(contratoId, estacaoId);
    await this.auditoriaService.registrar({
      acao: 'contratos.estacoes.desvincular',
      entidade: 'Contrato',
      entidadeId: contratoId,
      usuarioId: usuario.sub,
      detalhes: { estacaoId },
    });
    return { contratoId, estacaoId };
  }
}
