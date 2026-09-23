import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export const PERIODOS_DASHBOARD = ['24h', '7d', 'mes', 'customizado'] as const;
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number];

export class DashboardQueryDto {
  @IsOptional()
  @IsUUID()
  estacaoId?: string;

  @IsOptional()
  @IsDateString()
  de?: string;

  @IsOptional()
  @IsDateString()
  ate?: string;

  @IsOptional()
  @IsIn(PERIODOS_DASHBOARD)
  periodo?: PeriodoDashboard;
}