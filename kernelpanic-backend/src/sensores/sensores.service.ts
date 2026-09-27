import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarSensorDto } from './dto/atualizar-sensor.dto';
import { CriarSensorDto } from './dto/criar-sensor.dto';

const CONTAR_ESTACOES = { _count: { select: { parametros: true } } } satisfies Prisma.TipoParametroSelect;

@Injectable()
export class SensoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.tipoParametro.findMany({
      include: CONTAR_ESTACOES,
      orderBy: { nome: 'asc' },
    });
  }

  async criar(dto: CriarSensorDto) {
    await this.garantirNomeLivre(dto.nome);

    return this.prisma.tipoParametro.create({
      data: {
        nome: dto.nome,
        unidade: dto.unidade,
        fator: dto.fator,
        ganho: dto.ganho,
        json: dto.json as Prisma.InputJsonValue | undefined,
      },
      include: CONTAR_ESTACOES,
    });
  }

  async atualizar(id: string, dto: AtualizarSensorDto) {
    const sensor = await this.prisma.tipoParametro.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor não encontrado');
    }

    if (dto.nome && dto.nome !== sensor.nome) {
      await this.garantirNomeLivre(dto.nome, id);
    }

    return this.prisma.tipoParametro.update({
      where: { id },
      data: {
        nome: dto.nome,
        unidade: dto.unidade,
        fator: dto.fator,
        ganho: dto.ganho,
        json: dto.json as Prisma.InputJsonValue | undefined,
      },
      include: CONTAR_ESTACOES,
    });
  }

  async remover(id: string): Promise<void> {
    const sensor = await this.prisma.tipoParametro.findUnique({
      where: { id },
      include: CONTAR_ESTACOES,
    });

    if (!sensor) {
      throw new NotFoundException('Sensor não encontrado');
    }

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

  // ignorarId deixa o próprio sensor fora da busca: sem ele, corrigir só a
  // caixa do nome ("pluviômetro" -> "Pluviômetro") colidiria consigo mesmo.
  private async garantirNomeLivre(nome: string, ignorarId?: string): Promise<void> {
    const existente = await this.prisma.tipoParametro.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        id: ignorarId ? { not: ignorarId } : undefined,
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException('Já existe um sensor com este nome');
    }
  }
}
