import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { enviarCsv } from '../exportacao/csv';
import { AuditoriaService } from './auditoria.service';
import { autoria } from './autoria';
import { ListaAuditoriaRespostaDto } from './dto/lista-auditoria-resposta.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

// GET /auditoria fica fora do middleware de acesso (auditoria-acesso.middleware.ts):
// abrir a tela da trilha não pode gerar linha nova na própria trilha.
@Controller('auditoria')
@UseGuards(GuardaJwt, GuardaPerfil)
@Perfis(...PERFIS_ADMIN)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar(
    @Query() query: ListarAuditoriaQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<ListaAuditoriaRespostaDto> {
    return this.auditoriaService.listar(query, usuario);
  }

  // Exportar, ao contrário de consultar, é registrado: é a cópia da trilha
  // saindo do sistema.
  @Get('exportar')
  async exportar(
    @Query() query: ListarAuditoriaQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const lotes = this.auditoriaService.exportar(query, usuario);
    // Primeiro lote antes do cabeçalho HTTP: o 400 de período ausente ainda sai como JSON.
    const primeiro = await lotes.next();
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
      ['Data/hora', 'Usuário', 'Ação', 'Entidade', 'ID da entidade', 'Licitação', 'Detalhes'],
      linhas(),
    );
  }
}

function linhaAuditoria(registro: {
  criadoEm: Date;
  usuario: { nome: string } | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  licitacaoId: string | null;
  detalhes: unknown;
}): unknown[] {
  return [
    registro.criadoEm,
    registro.usuario?.nome ?? 'Visitante/sistema',
    registro.acao,
    registro.entidade,
    registro.entidadeId,
    registro.licitacaoId ?? 'Tecsus',
    registro.detalhes,
  ];
}
