import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperadorAlerta, SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

class ReferenciaDto {
  @ApiProperty({ format: 'uuid', example: '3f8a2c1e-9b4d-4e7a-8c21-5d6f7a8b9c0d', description: 'Identificador.' })
  id: string;

  @ApiProperty({ example: 'Estação Centro', description: 'Nome exibido.' })
  nome: string;
}

class ParametroIncidenteDto {
  @ApiProperty({ format: 'uuid', example: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', description: 'Tipo de parâmetro.' })
  id: string;

  @ApiProperty({ example: 'Pluviômetro', description: 'Nome do tipo de parâmetro.' })
  nome: string;

  @ApiProperty({ example: 'mm', description: 'Unidade de medida.' })
  unidade: string;
}

export class AcaoIncidenteDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2026-03-10T12:20:00.000Z', description: 'Quando a ação foi registrada.' })
  em: Date;

  @ApiProperty({ type: ReferenciaDto, nullable: true, description: 'Usuário que fez a ação (nulo se não registrado).' })
  por: ReferenciaDto | null;
}

export class OcorrenciaIncidenteDto {
  @ApiProperty({ format: 'uuid', example: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', description: 'Alerta (regra) que foi violado.' })
  alertaId: string;

  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: SeveridadeAlerta;

  @ApiProperty({ type: ReferenciaDto, description: 'Estação onde ocorreu.' })
  estacao: ReferenciaDto;

  @ApiProperty({ type: ParametroIncidenteDto, description: 'Parâmetro que superou o limiar.' })
  parametro: ParametroIncidenteDto;

  @ApiProperty({ enum: OperadorAlerta })
  operador: OperadorAlerta;

  @ApiProperty({ example: 30, description: 'Limiar configurado no alerta.' })
  valorLimite: number;

  @ApiProperty({ example: 50, description: 'Leitura mais distante do limiar no sentido do operador.' })
  valorPico: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-03-10T12:00:00.000Z', description: 'Primeira leitura acima do limiar.' })
  inicio: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-03-10T12:15:00.000Z', description: 'Última leitura acima do limiar.' })
  fim: Date;

  @ApiProperty({ example: 900, description: 'Duração da anomalia em segundos (fim − início).' })
  duracaoSegundos: number;

  @ApiProperty({ example: 4, description: 'Leituras acima do limiar na ocorrência.' })
  leituras: number;

  @ApiProperty({ enum: StatusAlarme })
  status: StatusAlarme;

  @ApiProperty({ type: AcaoIncidenteDto, nullable: true, description: 'Primeiro reconhecimento.' })
  reconhecimento: AcaoIncidenteDto | null;

  @ApiProperty({ type: AcaoIncidenteDto, nullable: true, description: 'Última resolução, quando todos os alarmes estão resolvidos.' })
  resolucao: AcaoIncidenteDto | null;

  @ApiProperty({ type: [String], example: ['Equipe enviada ao local'], description: 'Observações registradas nos alarmes.' })
  observacoes: string[];
}

export class ResumoSeveridadeDto {
  @ApiProperty({ enum: SeveridadeAlerta })
  severidade: SeveridadeAlerta;

  @ApiProperty({ example: 2, description: 'Ocorrências com essa severidade.' })
  ocorrencias: number;

  @ApiProperty({ example: 900, description: 'Soma das durações, em segundos.' })
  duracaoTotalSegundos: number;

  @ApiProperty({ example: 5, description: 'Leituras acima do limiar somadas.' })
  leituras: number;
}

export class ResumoEstacaoDto {
  @ApiProperty({ type: ReferenciaDto, description: 'Estação resumida.' })
  estacao: ReferenciaDto;

  @ApiProperty({ example: 2, description: 'Ocorrências na estação.' })
  ocorrencias: number;

  @ApiProperty({ example: 900, description: 'Soma das durações, em segundos.' })
  duracaoTotalSegundos: number;

  @ApiProperty({ example: 5, description: 'Leituras acima do limiar somadas.' })
  leituras: number;

  @ApiProperty({ enum: SeveridadeAlerta, description: 'Severidade mais alta entre as ocorrências da estação.' })
  maiorSeveridade: SeveridadeAlerta;
}

export class FiltrosIncidentesDto {
  @ApiPropertyOptional({ enum: SeveridadeAlerta })
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({
    description: 'Raio em torno de um ponto, quando informado.',
    example: { latitude: -23.18, longitude: -45.88, raioKm: 5 },
  })
  regiao?: { latitude: number; longitude: number; raioKm: number };

  @ApiPropertyOptional({ example: 'Jacareí', description: 'Trecho do endereço da estação usado no filtro.' })
  endereco?: string;

  @ApiPropertyOptional({ format: 'uuid', example: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', description: 'Licitação consultada.' })
  licitacaoId?: string;
}

export class RelatorioIncidentesDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2026-03-01T00:00:00.000Z', description: 'Início do período aplicado.' })
  de: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-03-31T23:59:59.999Z', description: 'Fim do período aplicado.' })
  ate: string;

  @ApiProperty({ example: 30, description: 'Intervalo máximo, em minutos, entre leituras da mesma ocorrência.' })
  toleranciaMinutos: number;

  @ApiProperty({ type: FiltrosIncidentesDto, description: 'Filtros aplicados.' })
  filtros: FiltrosIncidentesDto;

  @ApiProperty({ type: [ResumoSeveridadeDto], description: 'As três severidades, mesmo sem ocorrência.' })
  resumoPorSeveridade: ResumoSeveridadeDto[];

  @ApiProperty({ type: [ResumoEstacaoDto], description: 'Estações com ocorrência, da que teve mais para a que teve menos.' })
  resumoPorEstacao: ResumoEstacaoDto[];

  @ApiProperty({ type: [OcorrenciaIncidenteDto], description: 'Mais recente primeiro.' })
  ocorrencias: OcorrenciaIncidenteDto[];
}
