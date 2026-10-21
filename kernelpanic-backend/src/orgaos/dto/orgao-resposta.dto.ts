import type { OrgaoPublico } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class OrgaoRespostaDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  nome: string;
  @ApiProperty({ nullable: true })
  cnpj: string | null;
  @ApiProperty()
  esfera: string;
  @ApiProperty()
  municipio: string;
  @ApiProperty()
  uf: string;
  @ApiProperty()
  ativo: boolean;
  @ApiProperty()
  criadoEm: Date;
  @ApiProperty()
  atualizadoEm: Date;

  constructor(orgao: OrgaoPublico) {
    this.id = orgao.id;
    this.nome = orgao.nome;
    this.cnpj = orgao.cnpj;
    this.esfera = orgao.esfera;
    this.municipio = orgao.municipio;
    this.uf = orgao.uf;
    this.ativo = orgao.ativo;
    this.criadoEm = orgao.criadoEm;
    this.atualizadoEm = orgao.atualizadoEm;
  }
}
