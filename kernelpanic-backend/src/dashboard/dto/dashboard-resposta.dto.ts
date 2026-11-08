import { ApiProperty } from '@nestjs/swagger';

export class PeriodoDashboardDto {
  @ApiProperty({ example: '2026-11-07T14:00:00.000Z', description: 'Início do período (ISO 8601, UTC).' })
  de!: string;

  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Fim do período (ISO 8601, UTC).' })
  ate!: string;
}

export class EstacaoDashboardDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome!: string;

  @ApiProperty({ example: 'Praça Afonso Pena, 100 - Centro' })
  endereco!: string;
}

export class IndicadoresDashboardDto {
  @ApiProperty({ example: 4, description: 'Estações que mediram algo no período.' })
  estacoesAtivas!: number;

  @ApiProperty({ example: 1280, description: 'Quantidade de leituras consideradas (no máximo 5000 pontos por consulta).' })
  leituras!: number;

  @ApiProperty({ type: Number, example: 23.4, nullable: true, description: 'Média simples de todos os valores do período; null sem leituras.' })
  media!: number | null;

  @ApiProperty({ example: 2, description: 'Alarmes ABERTOS disparados no período.' })
  alarmesAbertos!: number;
}

export class PontoSerieDto {
  @ApiProperty({ example: '2026-11-08T13:50:00.000Z', description: 'Momento da leitura (ISO 8601, UTC).' })
  timestamp!: string;

  @ApiProperty({ example: 24.6, description: 'Valor da leitura, na unidade do parâmetro.' })
  valor!: number;
}

export class SerieDashboardDto {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222', description: 'Id do parâmetro (sensor da estação).' })
  parametroId!: string;

  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;

  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId!: string;

  @ApiProperty({ example: 'Estação Centro' })
  estacaoNome!: string;

  @ApiProperty({ type: [PontoSerieDto], description: 'Pontos em ordem cronológica.' })
  pontos!: PontoSerieDto[];
}

export class DashboardRespostaDto {
  @ApiProperty({ type: String, example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', nullable: true, description: 'Licitação do escopo; null no dashboard geral da Tecsus.' })
  licitacaoId!: string | null;

  @ApiProperty({ type: PeriodoDashboardDto })
  periodo!: PeriodoDashboardDto;

  @ApiProperty({ type: [EstacaoDashboardDto], description: 'Estações do escopo.' })
  estacoes!: EstacaoDashboardDto[];

  @ApiProperty({ type: IndicadoresDashboardDto })
  indicadores!: IndicadoresDashboardDto;

  @ApiProperty({ type: [SerieDashboardDto], description: 'Uma série por sensor de cada estação.' })
  series!: SerieDashboardDto[];
}
