import { ApiProperty } from '@nestjs/swagger';

export class ParametroConfigurado {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111', description: 'Id do tipo de parâmetro (sensor).' })
  tipoParametroId!: string;

  @ApiProperty({ example: 'temperatura', description: 'Nome do sensor, como deve vir em `leituras`.' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;

  @ApiProperty({ example: 0.1, description: 'Fator que multiplica a leitura bruta.' })
  fator!: number;

  @ApiProperty({ example: 0, description: 'Ganho somado à leitura bruta, depois do fator.' })
  ganho!: number;
}

export class EstacaoParametrosRespostaDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId: string;

  @ApiProperty({ example: 'A4:CF:12:9B:77:01', description: 'Identificador (vid) da estação.' })
  vid: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome: string;

  @ApiProperty({ type: [ParametroConfigurado], description: 'Sensores configurados na estação.' })
  parametros: ParametroConfigurado[];

  constructor(estacaoId: string, vid: string, nome: string, parametros: ParametroConfigurado[]) {
    this.estacaoId = estacaoId;
    this.vid = vid;
    this.nome = nome;
    this.parametros = parametros;
  }
}
