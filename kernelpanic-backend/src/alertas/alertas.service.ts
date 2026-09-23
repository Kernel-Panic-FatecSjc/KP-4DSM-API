import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertaRespostaDto } from './dto/alerta-resposta.dto';
import { AtualizarAlertaDto } from './dto/atualizar-alerta.dto';
import { CriarAlertaDto } from './dto/criar-alerta.dto';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

const INCLUDE_RELACOES = {
  parametro: {
    include: {
      estacao: true,
      tipoParametro: true,
    },
  },
} satisfies Prisma.AlertaInclude;

@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarAlertaDto) {
    return this.prisma.alerta.create({
      data: {
        operador: dto.operador,
        valorLimite: dto.valorLimite,
        severidade: dto.severidade,
        parametroId: dto.parametroId,
      },
      include: INCLUDE_RELACOES,
    });
  }

  async atualizar(id: string, dto: AtualizarAlertaDto) {
    const existente = await this.prisma.alerta.findUnique({ where: { id } });
    if (!existente) throw new NotFoundException('Alerta não encontrado');

    return this.prisma.alerta.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELACOES,
    });
  }

  async listar(query: ListarAlertasQueryDto): Promise<ListaAlertasRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;

    const where: Prisma.AlertaWhereInput = {
      severidade: query.severidade,
      ativo: query.ativo,
      parametro: {
        estacaoId: query.estacaoId,
        tipoParametroId: query.tipoParametroId,
      },
    };

    const [registros, total] = await Promise.all([
      this.prisma.alerta.findMany({
        where,
        include: INCLUDE_RELACOES,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.alerta.count({ where }),
    ]);

    return new ListaAlertasRespostaDto(
      registros.map((registro) => new AlertaRespostaDto(registro)),
      total,
      pagina,
      tamanho,
    );
  }

  async buscarOpcoesFiltro(): Promise<OpcoesFiltroAlertasRespostaDto> {
    const [estacoes, tiposParametro] = await Promise.all([
      this.prisma.estacao.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      this.prisma.tipoParametro.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    ]);

    return new OpcoesFiltroAlertasRespostaDto(estacoes, tiposParametro);
  }
}
