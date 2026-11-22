import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MotivoLeituraErro } from '../../generated/prisma/client';

export class ListarLeiturasErroQueryDto {
  @ApiPropertyOptional({ example: 'A4:CF:12:9B:77:01', maxLength: 64, description: 'Trecho do identificador (vid) da estação.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vidEstacao?: string;

  @ApiPropertyOptional({ enum: MotivoLeituraErro, description: 'Por que a leitura não virou medida.' })
  @IsOptional()
  @IsEnum(MotivoLeituraErro)
  motivo?: MotivoLeituraErro;

  // Só a Tecsus escolhe; o usuário de licitação vê só as da dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação. Só a Tecsus escolhe; o usuário de licitação vê só as da dele.',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Início do período de registro (data ou instante ISO 8601).' })
  @IsOptional()
  @IsDateString()
  de?: string;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Fim do período de registro (data ou instante ISO 8601).' })
  @IsOptional()
  @IsDateString()
  ate?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50, example: 50, description: 'Itens por página.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho = 50;
}
