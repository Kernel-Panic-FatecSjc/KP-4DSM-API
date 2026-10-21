import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarOrgaoPublicoDto } from './dto/criar-orgao-publico.dto';

function violouUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    (erro as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class OrgaosPublicosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.orgaoPublico.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
  }

  async criar(dto: CriarOrgaoPublicoDto) {
    try {
      return await this.prisma.orgaoPublico.create({
        data: {
          nome: dto.nome.trim(),
          cnpj: dto.cnpj,
          esfera: dto.esfera,
          municipio: dto.municipio.trim(),
          uf: dto.uf.toUpperCase(),
        },
      });
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException('Já existe um órgão com este CNPJ');
      }
      throw erro;
    }
  }
}
