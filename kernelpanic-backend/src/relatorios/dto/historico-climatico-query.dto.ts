import { Expose, Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

export const GRANULARIDADES_HISTORICO = ['hora', 'dia'] as const;
export type GranularidadeHistorico = (typeof GRANULARIDADES_HISTORICO)[number];

export class HistoricoClimaticoQueryDto {
  @IsDateString({ strict: true })
  de!: string;

  @IsDateString({ strict: true })
  ate!: string;

  @IsIn(GRANULARIDADES_HISTORICO)
  granularidade!: GranularidadeHistorico;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  estacaoIds?: string[];

  @IsOptional()
  @Expose({ name: 'estacaoIds[]' })
  @Transform(({ value }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  estacaoIdsComColchetes?: string[];
}
