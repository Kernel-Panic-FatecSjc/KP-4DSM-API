import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { StatusLicitacao } from '../generated/prisma/client';
import { ehTecsus, garantirAcessoLicitacao, licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarSensorDto } from './dto/atualizar-sensor.dto';
import { CriarSensorDto } from './dto/criar-sensor.dto';
import { ListarSensoresQueryDto } from './dto/listar-sensores-query.dto';

const CONTAR_ESTACOES = { _count: { select: { parametros: true } } } satisfies Prisma.TipoParametroSelect;

@Injectable()
export class SensoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarSensoresQueryDto, usuario: UsuarioLogado) {
    const busca = query.busca?.trim();
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where: Prisma.TipoParametroWhereInput = {
      licitacaoId: licitacaoDoEscopo(usuario, query.licitacaoId),
      nome: busca ? { contains: busca, mode: 'insensitive' } : undefined,
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.tipoParametro.findMany({
        where,
        include: CONTAR_ESTACOES,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.tipoParametro.count({ where }),
    ]);
    return { itens, total, pagina, tamanho };
  }

  async criar(dto: CriarSensorDto, usuario: UsuarioLogado) {
    const licitacaoId = ehTecsus(usuario) ? dto.licitacaoId : licitacaoDoEscopo(usuario, dto.licitacaoId);
    if (!licitacaoId) {
      throw new BadRequestException('Informe a licitação do sensor');
    }
    const licitacao = await this.prisma.licitacao.findUnique({ where: { id: licitacaoId }, select: { status: true } });
    if (!licitacao) {
      throw new BadRequestException('Licitação não encontrada');
    }
    if (licitacao.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Licitação encerrada não recebe sensores');
    }

    await this.garantirNomeLivre(dto.nome, licitacaoId);
    this.garantirFaixaValida(dto.valorMinimo, dto.valorMaximo);

    return this.prisma.tipoParametro.create({
      data: {
        nome: dto.nome,
        unidade: dto.unidade,
        fator: dto.fator,
        ganho: dto.ganho,
        valorMinimo: dto.valorMinimo,
        valorMaximo: dto.valorMaximo,
        json: dto.json as Prisma.InputJsonValue | undefined,
        licitacaoId,
      },
      include: CONTAR_ESTACOES,
    });
  }

  async atualizar(id: string, dto: AtualizarSensorDto, usuario: UsuarioLogado) {
    const sensor = await this.buscar(id, usuario);

    if (dto.nome && dto.nome !== sensor.nome) {
      await this.garantirNomeLivre(dto.nome, sensor.licitacaoId, id);
    }

    // Os limites não enviados continuam os do cadastro: a faixa final é que
    // precisa fazer sentido, não só o que veio no corpo.
    this.garantirFaixaValida(
      dto.valorMinimo === undefined ? sensor.valorMinimo : dto.valorMinimo,
      dto.valorMaximo === undefined ? sensor.valorMaximo : dto.valorMaximo,
    );

    return this.prisma.tipoParametro.update({
      where: { id },
      data: {
        nome: dto.nome,
        unidade: dto.unidade,
        fator: dto.fator,
        ganho: dto.ganho,
        valorMinimo: dto.valorMinimo,
        valorMaximo: dto.valorMaximo,
        json: dto.json as Prisma.InputJsonValue | undefined,
      },
      include: CONTAR_ESTACOES,
    });
  }

  async remover(id: string, usuario: UsuarioLogado): Promise<void> {
    const sensor = await this.buscar(id, usuario);

    // TipoParametro não tem onDelete definido: o banco recusaria a exclusão
    // com erro de chave estrangeira. A checagem transforma isso numa resposta
    // clara, e protege as medidas que pendem desses parâmetros.
    if (sensor._count.parametros > 0) {
      throw new ConflictException(
        'Não é possível excluir um sensor associado a estações; remova a associação antes',
      );
    }

    await this.prisma.tipoParametro.delete({ where: { id } });
  }

  private async buscar(id: string, usuario: UsuarioLogado) {
    const sensor = await this.prisma.tipoParametro.findUnique({ where: { id }, include: CONTAR_ESTACOES });
    if (!sensor) {
      throw new NotFoundException('Sensor não encontrado');
    }
    garantirAcessoLicitacao(usuario, sensor.licitacaoId);
    return sensor;
  }

  // Os dois limites são inclusivos, então mínimo igual ao máximo é uma faixa de um valor só.
  private garantirFaixaValida(minimo?: number | null, maximo?: number | null): void {
    if (minimo != null && maximo != null && minimo > maximo) {
      throw new BadRequestException('valorMinimo não pode ser maior que valorMaximo');
    }
  }

  // O nome é o que a estação manda no payload: único dentro da licitação.
  // ignorarId deixa o próprio sensor fora da busca: sem ele, corrigir só a
  // caixa do nome ("pluviômetro" -> "Pluviômetro") colidiria consigo mesmo.
  private async garantirNomeLivre(nome: string, licitacaoId: string, ignorarId?: string): Promise<void> {
    const existente = await this.prisma.tipoParametro.findFirst({
      where: {
        licitacaoId,
        nome: { equals: nome, mode: 'insensitive' },
        id: ignorarId ? { not: ignorarId } : undefined,
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException('Já existe um sensor com este nome nesta licitação');
    }
  }
}
