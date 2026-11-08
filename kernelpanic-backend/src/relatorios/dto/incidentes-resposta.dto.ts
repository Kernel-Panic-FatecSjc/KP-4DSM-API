import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperadorAlerta, SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

class ReferenciaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;
}

class ParametroIncidenteDto extends ReferenciaDto {
  @ApiProperty({ example: 'mm' })
  unidade: string;
}

export class AcaoIncidenteDto {
  @ApiProperty({ type: String, format: 'date-time' })
  em: Date;

  @ApiProperty({ type: ReferenciaDto, nullable: true })
  por: ReferenciaDto | null;
}

export class OcorrenciaIncidenteDto {
  @ApiProperty({ format: 'uuid', description: 'Alerta (regra) que foi violado.' })
  alertaId: string;

  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: SeveridadeAlerta;

  @ApiProperty({ type: ReferenciaDto })
  estacao: ReferenciaDto;

  @ApiProperty({ type: ParametroIncidenteDto, description: 'Parâmetro que superou o limiar.' })
  parametro: ParametroIncidenteDto;

  @ApiProperty({ enum: OperadorAlerta })
  operador: OperadorAlerta;

  @ApiProperty()
  valorLimite: number;

  @ApiProperty({ description: 'Leitura mais distante do limiar no sentido do operador.' })
  valorPico: number;

  @ApiProperty({ type: String, format: 'date-time' })
  inicio: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  fim: Date;

  @ApiProperty({ description: 'Duração da anomalia em segundos (fim − início).' })
  duracaoSegundos: number;

  @ApiProperty({ description: 'Leituras acima do limiar na ocorrência.' })
  leituras: number;

  @ApiProperty({ enum: StatusAlarme })
  status: StatusAlarme;

  @ApiProperty({ type: AcaoIncidenteDto, nullable: true, description: 'Primeiro reconhecimento.' })
  reconhecimento: AcaoIncidenteDto | null;

  @ApiProperty({ type: AcaoIncidenteDto, nullable: true, description: 'Última resolução, quando todos os alarmes estão resolvidos.' })
  resolucao: AcaoIncidenteDto | null;

  @ApiProperty({ type: [String] })
  observacoes: string[];
}

export class ResumoSeveridadeDto {
  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: SeveridadeAlerta;

  @ApiProperty()
  ocorrencias: number;

  @ApiProperty({ description: 'Soma das durações, em segundos.' })
  duracaoTotalSegundos: number;

  @ApiProperty()
  leituras: number;
}

export class ResumoEstacaoDto {
  @ApiProperty({ type: ReferenciaDto })
  estacao: ReferenciaDto;

  @ApiProperty()
  ocorrencias: number;

  @ApiProperty()
  duracaoTotalSegundos: number;

  @ApiProperty()
  leituras: number;

  @ApiProperty({ enum: SeveridadeAlerta, description: 'Severidade mais alta entre as ocorrências da estação.' })
  maiorSeveridade: SeveridadeAlerta;
}

export class FiltrosIncidentesDto {
  @ApiPropertyOptional({ enum: SeveridadeAlerta })
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({ description: 'Raio em torno de um ponto, quando informado.' })
  regiao?: { latitude: number; longitude: number; raioKm: number };

  @ApiPropertyOptional()
  endereco?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  licitacaoId?: string;
}

export class RelatorioIncidentesDto {
  @ApiProperty({ type: String, format: 'date-time' })
  de: string;

  @ApiProperty({ type: String, format: 'date-time' })
  ate: string;

  @ApiProperty()
  toleranciaMinutos: number;

  @ApiProperty({ type: FiltrosIncidentesDto })
  filtros: FiltrosIncidentesDto;

  @ApiProperty({ type: [ResumoSeveridadeDto], description: 'As três severidades, mesmo sem ocorrência.' })
  resumoPorSeveridade: ResumoSeveridadeDto[];

  @ApiProperty({ type: [ResumoEstacaoDto], description: 'Estações com ocorrência, da que teve mais para a que teve menos.' })
  resumoPorEstacao: ResumoEstacaoDto[];

  @ApiProperty({ type: [OcorrenciaIncidenteDto], description: 'Mais recente primeiro.' })
  ocorrencias: OcorrenciaIncidenteDto[];
}
