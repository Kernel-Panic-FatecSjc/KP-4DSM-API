import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { Proibido, RequisicaoInvalida, RotaLogada } from '../documentacao/respostas';
import { enviarCsv } from '../exportacao/csv';
import { AuditoriaService } from './auditoria.service';
import { autoria } from './autoria';
import { AuditoriaRespostaDto } from './dto/auditoria-resposta.dto';
import { ListaAuditoriaRespostaDto } from './dto/lista-auditoria-resposta.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

// GET /auditoria fica fora do middleware de acesso (auditoria-acesso.middleware.ts):
// abrir a tela da trilha não pode gerar linha nova na própria trilha.
@ApiTags('auditoria')
@Controller('auditoria')
@UseGuards(GuardaJwt, GuardaPerfil)
@Perfis(...PERFIS_ADMIN)
@RotaLogada()
@Proibido('Perfil sem permissão: só os administradores consultam a trilha.')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar a trilha de auditoria',
    description:
      'Registros paginados, do mais recente para o mais antigo. A Tecsus vê todos; o admin da licitação lê só a trilha da própria licitação. Consultar não gera registro novo.',
  })
  @ApiOkResponse({ type: ListaAuditoriaRespostaDto, description: 'Página de registros de auditoria.' })
  @RequisicaoInvalida('Filtro ou paginação inválidos.')
  listar(
    @Query() query: ListarAuditoriaQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<ListaAuditoriaRespostaDto> {
    return this.auditoriaService.listar(query, usuario);
  }

  // Exportar, ao contrário de consultar, é registrado: é a cópia da trilha
  // saindo do sistema.
  @Get('exportar')
  @ApiOperation({
    summary: 'Exportar a trilha de auditoria em CSV',
    description:
      'Arquivo CSV gerado em streaming (separador `;`, BOM UTF-8). O período (`de` e `ate`) é obrigatório. A exportação é registrada na própria trilha.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Arquivo CSV com os registros do período.',
    content: { 'text/csv': { schema: { type: 'string', example: 'Data/hora;Usuário;Ação;Entidade;ID da entidade;Licitação;Detalhes' } } },
  })
  @RequisicaoInvalida('Período (`de` e `ate`) ausente ou inválido.')
  async exportar(
    @Query() query: ListarAuditoriaQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const lotes = this.auditoriaService.exportar(query, usuario);
    // Primeiro lote antes do cabeçalho HTTP: o 400 de período ausente e o 422
    // de filtro sem registro ainda saem como JSON.
    const primeiro = await lotes.next();
    // UC11-R5: só exporta quando o filtro traz pelo menos um registro. Um CSV
    // só com o cabeçalho pareceria uma trilha vazia, e não um filtro sem resultado.
    if (primeiro.done || primeiro.value.length === 0) {
      throw new UnprocessableEntityException('Nenhum registro de auditoria para os filtros informados: não há o que exportar');
    }
    await this.auditoriaService.registrar({
      acao: 'auditoria.exportar',
      entidade: 'LogAuditoria',
      ...autoria(usuario),
      detalhes: { de: query.de, ate: query.ate, acao: query.acao, entidade: query.entidade },
    });

    async function* linhas() {
      if (primeiro.done) return;
      yield primeiro.value.map(linhaAuditoria);
      for await (const lote of lotes) yield lote.map(linhaAuditoria);
    }

    await enviarCsv(
      resposta,
      'auditoria.csv',
      CABECALHO_CSV_AUDITORIA,
      linhas(),
    );
  }
}

/**
 * Mesmos campos da consulta (GET /auditoria, já com o IP mascarado e sem dados
 * sensíveis), mais os ids que permitem rastrear o registro de volta na trilha.
 */
export const CABECALHO_CSV_AUDITORIA = [
  'ID do registro',
  'Data/hora',
  'ID do usuário',
  'Usuário',
  'Ação',
  'Entidade',
  'ID da entidade',
  'IP de origem (mascarado)',
  'Licitação',
  'Detalhes',
];

export function linhaAuditoria(registro: AuditoriaRespostaDto): unknown[] {
  return [
    registro.id,
    registro.criadoEm,
    registro.usuario?.id ?? null,
    registro.usuario?.nome ?? 'Visitante/sistema',
    registro.acao,
    registro.entidade,
    registro.entidadeId,
    registro.enderecoIp,
    registro.licitacaoId ?? 'Tecsus',
    registro.detalhes,
  ];
}
