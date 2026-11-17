import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export const PERIODOS_DASHBOARD = ['24h', '7d', 'mes', 'customizado'] as const;
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number];

export class DashboardQueryDto {
  // Só a Tecsus escolhe (dashboard geral filtrado); o usuário de licitação vê a dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação. Só a Tecsus escolhe (dashboard geral filtrado); o usuário de licitação vê a dele.',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Limita a uma estação.' })
  @IsOptional()
  @IsUUID()
  estacaoId?: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Início do período customizado (data ou instante ISO 8601). Exige `ate`.' })
  @IsOptional()
  @IsDateString()
  de?: string;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Fim do período customizado (data ou instante ISO 8601). Exige `de`.' })
  @IsOptional()
  @IsDateString()
  ate?: string;

  @ApiPropertyOptional({
    enum: PERIODOS_DASHBOARD,
    default: '24h',
    description: 'Período predefinido. Com `customizado` (ou ao informar `de` e `ate`) vale o intervalo informado.',
  })
  @IsOptional()
  @IsIn(PERIODOS_DASHBOARD)
  periodo?: PeriodoDashboard;
}
