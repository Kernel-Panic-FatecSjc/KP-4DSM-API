import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgregacaoParametro, type TipoParametro } from '../../generated/prisma/client';
import { UnidadeSensor } from '../unidade-sensor';

export class SensorRespostaDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;
  @ApiProperty({ example: 'Pluviômetro' })
  nome: string;
  @ApiProperty({ example: 'mm', description: 'Unidade de medida.' })
  unidade: string;
  @ApiProperty({ example: 0.2, description: 'Fator que multiplica a leitura bruta.' })
  fator: number;
  @ApiProperty({ example: 0, description: 'Ganho somado à leitura bruta, depois do fator.' })
  ganho: number;
  @ApiProperty({ enum: AgregacaoParametro, description: 'Regra de agregação dos relatórios.' })
  agregacao: TipoParametro['agregacao'];
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true, example: { modelo: 'PL-100' }, description: 'Metadados livres do sensor.' })
  json: unknown;
  @ApiProperty({ type: Number, example: 0, nullable: true, description: 'Menor valor físico válido (inclusivo); null sem limite.' })
  valorMinimo: number | null;
  @ApiProperty({ type: Number, example: 500, nullable: true, description: 'Maior valor físico válido (inclusivo); null sem limite.' })
  valorMaximo: number | null;
  @ApiPropertyOptional({ example: 3, description: 'Quantidade de estações que usam o sensor (só nas listagens).' })
  estacoesAssociadas?: number;
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Licitação dona do sensor.' })
  licitacaoId: string;

  constructor(sensor: TipoParametro & { _count?: { parametros: number } }) {
    this.id = sensor.id;
    this.nome = sensor.nome;
    this.unidade = sensor.unidade;
    this.fator = sensor.fator;
    this.ganho = sensor.ganho;
    this.agregacao = sensor.agregacao;
    this.json = sensor.json;
    this.valorMinimo = sensor.valorMinimo;
    this.valorMaximo = sensor.valorMaximo;
    this.estacoesAssociadas = sensor._count?.parametros;
    this.licitacaoId = sensor.licitacaoId;
  }
}

export class ListaSensoresRespostaDto {
  @ApiProperty({ type: [SensorRespostaDto], description: 'Sensores da página.' })
  itens: SensorRespostaDto[];
  @ApiProperty({ example: 12, description: 'Total de sensores do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: SensorRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}

export class UnidadeSensorRespostaDto {
  @ApiProperty({ enum: UnidadeSensor, example: UnidadeSensor.MILIMETRO, description: 'Símbolo da unidade, valor aceito em `unidade`.' })
  valor!: UnidadeSensor;
  @ApiProperty({ example: 'Milímetro', description: 'Nome da unidade.' })
  nome!: string;
  @ApiProperty({ example: 'Precipitação', description: 'Grandeza medida.' })
  grandeza!: string;
}
