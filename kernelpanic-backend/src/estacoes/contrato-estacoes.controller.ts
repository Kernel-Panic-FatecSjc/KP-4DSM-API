import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { EstacaoRespostaDto } from './dto/estacao-resposta.dto';
import { EstacoesService } from './estacoes.service';

// Sem auditoria explícita: o middleware de acesso já registra todo GET.
@ApiTags('contratos')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Cookie de sessão ausente ou inválido' })
@Controller()
@UseGuards(GuardaJwt)
export class ContratoEstacoesController {
  constructor(private readonly estacoesService: EstacoesService) {}

  @Get('contratos/:id/estacoes')
  @ApiOperation({
    summary: 'Lista estações e sensores de um contrato',
    description: 'Retorna a hierarquia contrato → estações → sensores configurados.',
  })
  @ApiOkResponse({ type: EstacaoRespostaDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
  async listar(@Param('id') contratoId: string): Promise<EstacaoRespostaDto[]> {
    const estacoes = await this.estacoesService.listarPorContrato(contratoId);
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }
}
