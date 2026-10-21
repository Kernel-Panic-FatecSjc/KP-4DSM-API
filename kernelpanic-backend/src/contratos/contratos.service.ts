import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarContratoDto } from './dto/atualizar-contrato.dto';
import { CriarContratoDto } from './dto/criar-contrato.dto';

const INCLUIR_ORGAO = { orgao: true } satisfies Prisma.ContratoInclude;
const TRANSICOES_PERMITIDAS: Record<StatusContrato, StatusContrato[]> = {
  RASCUNHO: [StatusContrato.VIGENTE, StatusContrato.ENCERRADO],
  VIGENTE: [StatusContrato.SUSPENSO, StatusContrato.ENCERRADO],
  SUSPENSO: [StatusContrato.VIGENTE, StatusContrato.ENCERRADO],
  ENCERRADO: [],
};
const MENSAGEM_NUMERO_DUPLICADO = 'Ja existe um contrato com este numero';

type ContratoComOrgao = Prisma.ContratoGetPayload<{
  include: typeof INCLUIR_ORGAO;
}>;

// P2002 = violação de unicidade. A checagem prévia de número não cobre duas
// requisições simultâneas; a constraint do banco é quem garante, e aqui o erro
// dela vira 409 em vez de estourar como 500.
function violouUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    (erro as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class ContratosService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<ContratoComOrgao> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: INCLUIR_ORGAO,
    });

    if (!contrato) {
      throw new NotFoundException('Contrato nao encontrado');
    }

    return contrato;
  }

  async criar(dto: CriarContratoDto): Promise<ContratoComOrgao> {
    const status = dto.status ?? StatusContrato.RASCUNHO;

    this.validarVigencia(dto.inicioVigencia, dto.fimVigencia);
    // Todo contrato nasce como rascunho: o status inicial segue o mesmo mapa de transições.
    this.validarTransicao(StatusContrato.RASCUNHO, status);
    if (status === StatusContrato.VIGENTE) {
      this.validarPrazoParaAtivacao(dto.fimVigencia);
    }
    await this.validarOrgaoAtivo(dto.orgaoId);
    await this.validarNumeroUnico(dto.numero);

    try {
      return await this.prisma.contrato.create({
        data: {
          numero: dto.numero,
          objeto: dto.objeto,
          inicioVigencia: new Date(this.normalizarData(dto.inicioVigencia)),
          fimVigencia: new Date(this.normalizarData(dto.fimVigencia, true)),
          status,
          orgaoId: dto.orgaoId,
          encerradoEm:
            status === StatusContrato.ENCERRADO ? new Date() : undefined,
        },
        include: INCLUIR_ORGAO,
      });
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(MENSAGEM_NUMERO_DUPLICADO);
      }
      throw erro;
    }
  }

  async atualizar(
    id: string,
    dto: AtualizarContratoDto,
  ): Promise<ContratoComOrgao> {
    const contrato = await this.buscarPorId(id);

    // Contrato encerrado é histórico: não aceita mais alteração de nenhum campo.
    if (contrato.status === StatusContrato.ENCERRADO) {
      throw new BadRequestException('Contrato encerrado nao pode ser alterado');
    }

    const inicioVigencia =
      dto.inicioVigencia ?? contrato.inicioVigencia.toISOString();
    const fimVigencia = dto.fimVigencia ?? contrato.fimVigencia.toISOString();
    this.validarVigencia(inicioVigencia, fimVigencia);

    if (dto.status && dto.status !== contrato.status) {
      this.validarTransicao(contrato.status, dto.status);
      if (dto.status === StatusContrato.VIGENTE) {
        this.validarPrazoParaAtivacao(fimVigencia);
      }
    }

    if (dto.orgaoId && dto.orgaoId !== contrato.orgaoId) {
      await this.validarOrgaoAtivo(dto.orgaoId);
    }

    if (dto.numero && dto.numero !== contrato.numero) {
      await this.validarNumeroUnico(dto.numero);
    }

    try {
      return await this.prisma.contrato.update({
        where: { id },
        data: {
          numero: dto.numero,
          objeto: dto.objeto,
          inicioVigencia: dto.inicioVigencia
            ? new Date(this.normalizarData(dto.inicioVigencia))
            : undefined,
          fimVigencia: dto.fimVigencia
            ? new Date(this.normalizarData(dto.fimVigencia, true))
            : undefined,
          status: dto.status,
          orgaoId: dto.orgaoId,
          encerradoEm:
            dto.status === StatusContrato.ENCERRADO ? new Date() : undefined,
        },
        include: INCLUIR_ORGAO,
      });
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(MENSAGEM_NUMERO_DUPLICADO);
      }
      throw erro;
    }
  }

  async encerrar(id: string): Promise<ContratoComOrgao> {
    const contrato = await this.buscarPorId(id);

    // Sem este bloqueio, reencerrar sobrescreveria o encerradoEm original.
    if (contrato.status === StatusContrato.ENCERRADO) {
      throw new BadRequestException('Contrato ja esta encerrado');
    }

    this.validarTransicao(contrato.status, StatusContrato.ENCERRADO);

    return this.prisma.contrato.update({
      where: { id },
      data: {
        status: StatusContrato.ENCERRADO,
        encerradoEm: new Date(),
      },
      include: INCLUIR_ORGAO,
    });
  }

  private validarVigencia(inicio: string, fim: string): void {
    const inicioVigencia = new Date(this.normalizarData(inicio));
    const fimVigencia = new Date(this.normalizarData(fim, true));
    if (fimVigencia.getTime() < inicioVigencia.getTime()) {
      throw new BadRequestException(
        'Fim da vigencia deve ser maior ou igual ao inicio',
      );
    }
  }

  private validarPrazoParaAtivacao(fim: string | Date): void {
    const fimVigencia =
      fim instanceof Date ? fim : new Date(this.normalizarData(fim, true));
    if (fimVigencia.getTime() < Date.now()) {
      throw new BadRequestException(
        'Contrato com vigencia expirada nao pode ser ativado',
      );
    }
  }

  private normalizarData(valor: string, fimDoDia = false): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return `${valor}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}Z`;
    }
    if (
      /^\d{4}-\d{2}-\d{2}T/.test(valor) &&
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)
    ) {
      return `${valor}Z`;
    }
    return valor;
  }

  private async validarNumeroUnico(numero: string): Promise<void> {
    const existente = await this.prisma.contrato.findUnique({
      where: { numero },
    });
    if (existente) {
      throw new ConflictException(MENSAGEM_NUMERO_DUPLICADO);
    }
  }

  private async validarOrgaoAtivo(orgaoId: string): Promise<void> {
    const orgao = await this.prisma.orgaoPublico.findUnique({
      where: { id: orgaoId },
    });
    if (!orgao) {
      throw new BadRequestException('Orgao nao encontrado');
    }
    if (!orgao.ativo) {
      throw new BadRequestException(
        'Orgao inativo nao pode ser vinculado ao contrato',
      );
    }
  }

  private validarTransicao(atual: StatusContrato, novo: StatusContrato): void {
    if (atual === novo) {
      return;
    }

    if (!TRANSICOES_PERMITIDAS[atual].includes(novo)) {
      throw new BadRequestException(
        `Transicao de status nao permitida: ${atual} para ${novo}`,
      );
    }
  }
}
