import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { enviarCsv } from '../exportacao/csv';
import { ListarLeiturasBrutasQueryDto } from './dto/listar-leituras-brutas-query.dto';
import { ListaLeiturasBrutasRespostaDto } from './dto/lista-leituras-brutas-resposta.dto';
import { LeiturasBrutasService } from './leituras-brutas.service';

@Controller('leituras-brutas')
@UseGuards(GuardaJwt, GuardaPerfil)
export class LeiturasBrutasController {
  constructor(
    private readonly leiturasBrutasService: LeiturasBrutasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  listar(
    @Query() query: ListarLeiturasBrutasQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<ListaLeiturasBrutasRespostaDto> {
    return this.leiturasBrutasService.listar(query, usuario);
  }

  /** CSV gerado no backend, em streaming, com período obrigatório (de e ate). */
  @Get('exportar')
  async exportar(
    @Query() query: ListarLeiturasBrutasQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    // Antes do primeiro byte: o 400 de período ausente ainda sai como JSON.
    const campos = await this.leiturasBrutasService.camposDaExportacao(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'leiturasBrutas.exportar',
      entidade: 'LeituraBruta',
      ...autoria(usuario),
      detalhes: { de: query.de, ate: query.ate, vidEstacao: query.vidEstacao, campo: query.campo },
    });

    const lotes = this.leiturasBrutasService.exportar(query, usuario);
    async function* linhas() {
      for await (const lote of lotes) {
        yield lote.map((leitura) => {
          const payload = (leitura.payload ?? {}) as Record<string, unknown>;
          return [
            leitura.id,
            leitura.vidEstacao,
            leitura.recebidoEm,
            leitura.unixtimeDispositivo,
            leitura.latitude,
            leitura.longitude,
            ...campos.map((campo) => payload[campo]),
          ];
        });
      }
    }

    await enviarCsv(
      resposta,
      'leituras-brutas.csv',
      [
        'ID da leitura',
        'VID da estação',
        'Recebida em',
        'Unix time do dispositivo',
        'Latitude',
        'Longitude',
        ...campos.map((campo) => `Leitura: ${campo}`),
      ],
      linhas(),
    );
  }
}
