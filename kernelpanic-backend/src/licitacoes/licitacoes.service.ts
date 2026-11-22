import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Licitacao, Prisma } from '../generated/prisma/client';
import { StatusLicitacao, StatusOperacionalEstacao } from '../generated/prisma/client';
import { garantirAcessoLicitacao, licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarLicitacaoDto } from './dto/atualizar-licitacao.dto';
import { CriarLicitacaoDto } from './dto/criar-licitacao.dto';
import { ListarLicitacoesQueryDto, PAGINA_PADRAO, TAMANHO_PADRAO } from './dto/listar-licitacoes-query.dto';

// As mesmas transições que valiam para o contrato (o contrato agora é a
// própria licitação). Encerrada é final.
const TRANSICOES_PERMITIDAS: Record<StatusLicitacao, StatusLicitacao[]> = {
  RASCUNHO: [StatusLicitacao.VIGENTE, StatusLicitacao.ENCERRADA],
  VIGENTE: [StatusLicitacao.SUSPENSA, StatusLicitacao.ENCERRADA],
  SUSPENSA: [StatusLicitacao.VIGENTE, StatusLicitacao.ENCERRADA],
  ENCERRADA: [],
};

const CONTAR_VINCULOS = { _count: { select: { estacoes: true, usuarios: true } } } satisfies Prisma.LicitacaoInclude;

const CAMPOS_UNICOS: Record<string, string> = {
  codigoIdentificador: 'Já existe uma licitação com este código',
  numeroProcesso: 'Já existe uma licitação com este número de processo',
  numeroContrato: 'Já existe uma licitação com este número de contrato',
};

export type LicitacaoComContagem = Prisma.LicitacaoGetPayload<{ include: typeof CONTAR_VINCULOS }>;

export interface LicitacoesPaginadas {
  itens: LicitacaoComContagem[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface ResultadoEncerramento {
  licitacao: Licitacao;
  estacoesInativadas: number;
  alertasInativados: number;
}

export interface ResultadoVinculo {
  estacoesVinculadas: number;
  alertasInativados: number;
}

function normalizarCnpj(cnpj: string | null | undefined): string | null | undefined {
  return cnpj === null ? null : cnpj?.replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

// P2002 = violação de unicidade. A checagem prévia não cobre duas requisições
// simultâneas; a constraint do banco é quem garante, e aqui o erro vira 409.
function mensagemDeUnicidade(erro: unknown): string | null {
  if (typeof erro !== 'object' || erro === null || (erro as { code?: unknown }).code !== 'P2002') return null;
  const alvo = JSON.stringify((erro as { meta?: unknown }).meta ?? '');
  const campo = Object.keys(CAMPOS_UNICOS).find((nome) => alvo.includes(nome));
  return campo ? CAMPOS_UNICOS[campo] : 'Já existe uma licitação com estes dados';
}

@Injectable()
export class LicitacoesService {
  constructor(private readonly prisma: PrismaService) {}

  /** A Tecsus lista todas; o usuário de licitação recebe só a dele. */
  async listar(query: ListarLicitacoesQueryDto, usuario: UsuarioLogado): Promise<LicitacoesPaginadas> {
    const busca = query.busca?.trim();
    const pagina = query.pagina ?? PAGINA_PADRAO;
    const tamanho = query.tamanho ?? TAMANHO_PADRAO;
    const where: Prisma.LicitacaoWhereInput = {
      id: licitacaoDoEscopo(usuario),
      status: query.status,
      orgaoEsfera: query.esfera,
      OR: busca
        ? [
            { codigoIdentificador: { contains: busca, mode: 'insensitive' } },
            { numeroProcesso: { contains: busca, mode: 'insensitive' } },
            { numeroContrato: { contains: busca, mode: 'insensitive' } },
            { objeto: { contains: busca, mode: 'insensitive' } },
            { orgaoNome: { contains: busca, mode: 'insensitive' } },
            { orgaoMunicipio: { contains: busca, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.licitacao.findMany({
        where,
        include: CONTAR_VINCULOS,
        orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.licitacao.count({ where }),
    ]);

    return { itens, total, pagina, tamanho };
  }

  async buscarPorId(id: string, usuario?: UsuarioLogado): Promise<Licitacao> {
    if (usuario) garantirAcessoLicitacao(usuario, id);
    const licitacao = await this.prisma.licitacao.findUnique({ where: { id } });
    if (!licitacao) {
      throw new NotFoundException('Licitação não encontrada');
    }
    return licitacao;
  }

  async criar(dto: CriarLicitacaoDto): Promise<Licitacao> {
    const status = dto.status ?? StatusLicitacao.RASCUNHO;

    this.validarVigencia(dto.inicioVigencia, dto.fimVigencia);
    // Toda licitação nasce como rascunho: o status inicial segue o mesmo mapa de transições.
    this.validarTransicao(StatusLicitacao.RASCUNHO, status);
    if (status === StatusLicitacao.VIGENTE) {
      this.validarPrazoParaAtivacao(dto.fimVigencia);
    }
    if (status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Uma licitação nova não pode nascer encerrada');
    }

    try {
      return await this.prisma.licitacao.create({
        data: {
          ...dto,
          orgaoCnpj: normalizarCnpj(dto.orgaoCnpj),
          inicioVigencia: new Date(this.normalizarData(dto.inicioVigencia)),
          fimVigencia: new Date(this.normalizarData(dto.fimVigencia, true)),
          status,
        },
      });
    } catch (erro) {
      const mensagem = mensagemDeUnicidade(erro);
      if (mensagem) throw new ConflictException(mensagem);
      throw erro;
    }
  }

  async atualizar(id: string, dto: AtualizarLicitacaoDto): Promise<Licitacao> {
    const licitacao = await this.buscarPorId(id);

    // Encerrada é histórico: não aceita mais alteração de nenhum campo.
    if (licitacao.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Licitação encerrada não pode ser alterada');
    }
    // Encerrar tem efeitos (estações e alertas) e rota própria.
    if (dto.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Use PATCH /licitacoes/:id/encerrar para encerrar a licitação');
    }

    const inicioVigencia = dto.inicioVigencia ?? licitacao.inicioVigencia.toISOString();
    const fimVigencia = dto.fimVigencia ?? licitacao.fimVigencia.toISOString();
    this.validarVigencia(inicioVigencia, fimVigencia);

    if (dto.status && dto.status !== licitacao.status) {
      this.validarTransicao(licitacao.status, dto.status);
      if (dto.status === StatusLicitacao.VIGENTE) {
        this.validarPrazoParaAtivacao(fimVigencia);
      }
    }

    try {
      return await this.prisma.licitacao.update({
        where: { id },
        data: {
          ...dto,
          orgaoCnpj: normalizarCnpj(dto.orgaoCnpj),
          inicioVigencia: dto.inicioVigencia ? new Date(this.normalizarData(dto.inicioVigencia)) : undefined,
          fimVigencia: dto.fimVigencia ? new Date(this.normalizarData(dto.fimVigencia, true)) : undefined,
        },
      });
    } catch (erro) {
      const mensagem = mensagemDeUnicidade(erro);
      if (mensagem) throw new ConflictException(mensagem);
      throw erro;
    }
  }

  /**
   * Encerra a licitação (docs/regras-licitacao.md): as estações continuam
   * dela, mas ficam inativas (a telemetria segue guardada em leituras_brutas,
   * sem virar medida) e os alertas param de disparar. Os usuários continuam
   * entrando, só para ler. Tudo na mesma transação.
   */
  async encerrar(id: string): Promise<ResultadoEncerramento> {
    const licitacao = await this.buscarPorId(id);

    // Sem este bloqueio, reencerrar sobrescreveria o encerradaEm original.
    if (licitacao.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Licitação já está encerrada');
    }
    this.validarTransicao(licitacao.status, StatusLicitacao.ENCERRADA);

    return this.prisma.$transaction(async (tx) => {
      const encerrada = await tx.licitacao.update({
        where: { id },
        data: { status: StatusLicitacao.ENCERRADA, encerradaEm: new Date() },
      });
      const estacoes = await tx.estacao.updateMany({
        where: { licitacaoId: id, statusOperacional: StatusOperacionalEstacao.ATIVA },
        data: { statusOperacional: StatusOperacionalEstacao.INATIVA },
      });
      const alertas = await tx.alerta.updateMany({
        where: { licitacaoId: id, ativo: true },
        data: { ativo: false },
      });
      return { licitacao: encerrada, estacoesInativadas: estacoes.count, alertasInativados: alertas.count };
    });
  }

  /**
   * Passa estações para esta licitação. Toda estação tem licitação, então
   * vincular é transferir. Os sensores da estação passam a apontar para os
   * tipos de mesmo nome da licitação de destino (que precisam existir lá); os
   * alertas ativos da origem são inativados e ficam como histórico dela, assim
   * como as medidas, que guardam a licitação de quando foram gravadas.
   */
  async vincularEstacoes(id: string, estacaoIds: string[]): Promise<ResultadoVinculo> {
    if (new Set(estacaoIds).size !== estacaoIds.length) {
      throw new BadRequestException('Não é permitido informar a mesma estação mais de uma vez');
    }

    const licitacao = await this.buscarPorId(id);
    if (licitacao.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Licitação encerrada não recebe estações');
    }

    return this.prisma.$transaction(async (tx) => {
      const estacoes = await tx.estacao.findMany({
        where: { id: { in: estacaoIds } },
        select: {
          id: true,
          nome: true,
          licitacaoId: true,
          parametros: { select: { id: true, tipoParametro: { select: { nome: true } } } },
        },
      });
      if (estacoes.length !== estacaoIds.length) {
        throw new NotFoundException('Uma ou mais estações não foram encontradas');
      }

      const aTransferir = estacoes.filter((estacao) => estacao.licitacaoId !== id);
      if (aTransferir.length === 0) {
        return { estacoesVinculadas: estacaoIds.length, alertasInativados: 0 };
      }

      const tiposDestino = await tx.tipoParametro.findMany({
        where: { licitacaoId: id },
        select: { id: true, nome: true },
      });
      const tipoPorNome = new Map(tiposDestino.map((tipo) => [tipo.nome.toLocaleLowerCase('pt-BR'), tipo.id]));

      const faltando = new Set(
        aTransferir.flatMap((estacao) =>
          estacao.parametros
            .map((parametro) => parametro.tipoParametro.nome)
            .filter((nome) => !tipoPorNome.has(nome.toLocaleLowerCase('pt-BR'))),
        ),
      );
      if (faltando.size > 0) {
        throw new BadRequestException(
          `Cadastre na licitação de destino os sensores usados pelas estações: ${[...faltando].sort().join(', ')}`,
        );
      }

      const idsTransferidos = aTransferir.map((estacao) => estacao.id);
      const alertas = await tx.alerta.updateMany({
        where: { ativo: true, licitacaoId: { not: id }, parametro: { estacaoId: { in: idsTransferidos } } },
        data: { ativo: false },
      });

      // Os triggers de consistência são adiados para o commit: a estação e os
      // tipos dos sensores dela mudam juntos, nesta transação.
      await tx.estacao.updateMany({ where: { id: { in: idsTransferidos } }, data: { licitacaoId: id } });
      for (const estacao of aTransferir) {
        for (const parametro of estacao.parametros) {
          await tx.parametro.update({
            where: { id: parametro.id },
            data: { tipoParametroId: tipoPorNome.get(parametro.tipoParametro.nome.toLocaleLowerCase('pt-BR')) },
          });
        }
      }

      return { estacoesVinculadas: estacaoIds.length, alertasInativados: alertas.count };
    });
  }

  private validarVigencia(inicio: string, fim: string): void {
    const inicioVigencia = new Date(this.normalizarData(inicio));
    const fimVigencia = new Date(this.normalizarData(fim, true));
    if (fimVigencia.getTime() < inicioVigencia.getTime()) {
      throw new BadRequestException('Fim da vigência deve ser maior ou igual ao início');
    }
  }

  private validarPrazoParaAtivacao(fim: string | Date): void {
    const fimVigencia = fim instanceof Date ? fim : new Date(this.normalizarData(fim, true));
    if (fimVigencia.getTime() < Date.now()) {
      throw new BadRequestException('Licitação com vigência expirada não pode ficar vigente');
    }
  }

  private normalizarData(valor: string, fimDoDia = false): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return `${valor}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}Z`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(valor) && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)) {
      return `${valor}Z`;
    }
    return valor;
  }

  private validarTransicao(atual: StatusLicitacao, novo: StatusLicitacao): void {
    if (atual === novo) return;
    if (!TRANSICOES_PERMITIDAS[atual].includes(novo)) {
      throw new BadRequestException(`Transição de status não permitida: ${atual} para ${novo}`);
    }
  }
}
