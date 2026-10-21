import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { OrgaoPublico } from '../../generated/prisma/client';
import { EsferaOrgao } from '../../generated/prisma/client';

export class OrgaoPublicoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  nome: string;
  @ApiPropertyOptional({ nullable: true })
  cnpj: string | null;
  @ApiProperty({ enum: EsferaOrgao })
  esfera: EsferaOrgao;
  @ApiProperty()
  municipio: string;
  @ApiProperty({ minLength: 2, maxLength: 2 })
  uf: string;
  @ApiProperty()
  ativo: boolean;

  constructor(orgao: OrgaoPublico) {
    this.id = orgao.id;
    this.nome = orgao.nome;
    this.cnpj = orgao.cnpj;
    this.esfera = orgao.esfera;
    this.municipio = orgao.municipio;
    this.uf = orgao.uf;
    this.ativo = orgao.ativo;
  }
}
