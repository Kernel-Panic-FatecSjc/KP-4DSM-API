import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '../generated/prisma/client';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { EstacaoRespostaDto } from './dto/estacao-resposta.dto';

const INCLUIR_SENSORES = {
  parametros: { include: { tipoParametro: true } },
} satisfies Prisma.EstacaoInclude;

@ApiTags('contratos')
@ApiBearerAuth()
@Controller()
@UseGuards(GuardaJwt)
export class ContratoEstacoesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get('contratos/:id/estacoes')
  @ApiOperation({
    summary: 'Lista estações e sensores de um contrato',
    description: 'Retorna a hierarquia contrato → estações → sensores configurados.',
  })
  @ApiOkResponse({ type: EstacaoRespostaDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Contrato não encontrado' })
  async listar(
    @Param('id') contratoId: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<EstacaoRespostaDto[]> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true },
    });
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const estacoes = await this.prisma.estacao.findMany({
      where: { contratoId },
      include: INCLUIR_SENSORES,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    await this.auditoriaService.registrar({
      acao: 'contratos.estacoes.consultar',
      entidade: 'Contrato',
      entidadeId: contratoId,
      usuarioId: usuario.sub,
    });
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }
}
