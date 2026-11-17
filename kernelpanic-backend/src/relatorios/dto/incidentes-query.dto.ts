import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SeveridadeAlerta } from '../../generated/prisma/client';
import { RAIO_REGIAO_KM } from '../../regiao/regiao';
import { TOLERANCIA_MAXIMA_MINUTOS, TOLERANCIA_PADRAO_MINUTOS } from '../ocorrencias';

/**
 * Filtros do relatório de incidentes (US10): severidade, período e região. A
 * região é um raio em torno de um ponto (PostGIS, como o resto da API) e/ou um
 * trecho do endereço da estação, como o filtro de GET /estacoes.
 */
export class IncidentesQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Início inclusivo (data ISO ou instante ISO 8601) da leitura.' })
  @IsDateString({ strict: true })
  de!: string;

  @ApiProperty({ example: '2026-01-31', description: 'Fim inclusivo (data ISO ou instante ISO 8601). Data sem horário vale o dia inteiro (UTC).' })
  @IsDateString({ strict: true })
  ate!: string;

  @ApiPropertyOptional({ enum: SeveridadeAlerta })
  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({ description: 'Centro da região (junto com longitude).', example: -23.18 })
  @ValidateIf((dto: IncidentesQueryDto) => dto.longitude !== undefined || dto.raioKm !== undefined)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Centro da região (junto com latitude).', example: -45.88 })
  @ValidateIf((dto: IncidentesQueryDto) => dto.latitude !== undefined || dto.raioKm !== undefined)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ description: `Raio da região em km (padrão ${RAIO_REGIAO_KM}).`, minimum: 0.1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  raioKm?: number;

  @ApiPropertyOptional({ description: 'Trecho do endereço da estação (bairro, cidade), sem diferenciar maiúsculas.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string;

  @ApiPropertyOptional({
    description: `Intervalo máximo entre leituras acima do limiar da mesma ocorrência (padrão ${TOLERANCIA_PADRAO_MINUTOS}).`,
    minimum: 1,
    maximum: TOLERANCIA_MAXIMA_MINUTOS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TOLERANCIA_MAXIMA_MINUTOS)
  toleranciaMinutos?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Só a Tecsus escolhe; os demais perfis ficam na própria licitação.' })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}
