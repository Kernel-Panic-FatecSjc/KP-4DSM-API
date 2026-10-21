import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarOrgaoDto } from './dto/atualizar-orgao.dto';
import { CriarOrgaoDto } from './dto/criar-orgao.dto';
import { ListarOrgaosQueryDto } from './dto/listar-orgaos-query.dto';

@Injectable()
export class OrgaosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(query: ListarOrgaosQueryDto) {
    const busca = query.busca?.trim();
    const termoCnpj =
      busca && /^[\d./\-\s]+$/.test(busca)
        ? busca.replace(/\D/g, '')
        : undefined;
    return this.prisma.orgaoPublico.findMany({
      where: {
        esfera: query.esfera,
        ativo: query.ativo,
        OR: busca
          ? [
              { nome: { contains: busca, mode: 'insensitive' } },
              ...(termoCnpj ? [{ cnpj: { contains: termoCnpj } }] : []),
              { municipio: { contains: busca, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async consultar(id: string) {
    const orgao = await this.prisma.orgaoPublico.findUnique({ where: { id } });
    if (!orgao) throw new NotFoundException('Órgão não encontrado');
    return orgao;
  }

  async criar(dto: CriarOrgaoDto) {
    const cnpj = dto.cnpj.replace(/\D/g, '');
    if (await this.prisma.orgaoPublico.findUnique({ where: { cnpj } })) {
      throw new ConflictException('Já existe um órgão com este CNPJ');
    }
    try {
      return await this.prisma.orgaoPublico.create({
        data: { ...dto, cnpj, uf: dto.uf.toUpperCase() },
      });
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um órgão com este CNPJ');
      }
      throw erro;
    }
  }

  async atualizar(id: string, dto: AtualizarOrgaoDto) {
    const orgao = await this.consultar(id);
    const cnpj = dto.cnpj?.replace(/\D/g, '');
    if (
      cnpj &&
      cnpj !== orgao.cnpj &&
      (await this.prisma.orgaoPublico.findUnique({ where: { cnpj } }))
    ) {
      throw new ConflictException('Já existe um órgão com este CNPJ');
    }
    try {
      return await this.prisma.orgaoPublico.update({
        where: { id },
        data: { ...dto, cnpj, uf: dto.uf?.toUpperCase() },
      });
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um órgão com este CNPJ');
      }
      throw erro;
    }
  }

  async inativar(id: string) {
    await this.consultar(id);
    // Inativar logicamente em todos os casos preserva referências e histórico contratual.
    return this.prisma.orgaoPublico.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
