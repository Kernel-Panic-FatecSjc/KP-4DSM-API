import { ApiProperty } from '@nestjs/swagger';
import { MotivoLeituraErro } from '../../generated/prisma/client';

export class LeituraErroRespostaDto {
  @ApiProperty({ example: '0b8f8a52-6f9b-4e83-bf7c-7a1f3b0f4a11' })
  id!: string;

  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', description: 'Leitura bruta de onde veio.' })
  leituraBrutaId!: string;

  @ApiProperty({ example: 'A4:CF:12:9B:77:01', description: 'Identificador (vid) da estação.' })
  vidEstacao!: string;

  @ApiProperty({ example: 'temperatura', description: 'Nome do sensor no pacote.' })
  nomeSensor!: string;

  @ApiProperty({ type: String, example: '22222222-2222-4222-8222-222222222222', nullable: true, description: 'Parâmetro configurado; null quando o sensor não está configurado na estação.' })
  parametroId!: string | null;

  @ApiProperty({ example: 912.5, description: 'Valor recebido.' })
  valor!: number;

  @ApiProperty({ example: '1792869809', description: 'Unix time (segundos) da leitura, como texto.' })
  unixtime!: string;

  @ApiProperty({ enum: MotivoLeituraErro, description: 'Por que a leitura não virou medida.' })
  motivo!: string;

  @ApiProperty({ type: Number, example: 0, nullable: true, description: 'Menor valor válido vigente quando a leitura chegou.' })
  valorMinimo!: number | null;

  @ApiProperty({ type: Number, example: 500, nullable: true, description: 'Maior valor válido vigente quando a leitura chegou.' })
  valorMaximo!: number | null;

  @ApiProperty({ example: '2026-11-08T14:32:11.000Z', description: 'Momento do registro (ISO 8601, UTC).' })
  registradoEm!: Date;

  @ApiProperty({ type: String, example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', nullable: true, description: 'Licitação da estação; null se a estação não existe.' })
  licitacaoId!: string | null;
}

export class ListaLeiturasErroRespostaDto {
  @ApiProperty({ type: [LeituraErroRespostaDto], description: 'Leituras com erro da página, da mais recente para a mais antiga.' })
  itens!: LeituraErroRespostaDto[];

  @ApiProperty({ example: 30, description: 'Total do filtro, somando todas as páginas.' })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho!: number;
}
