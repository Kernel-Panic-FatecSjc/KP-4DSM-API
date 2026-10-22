import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class VincularEstacoesContratoDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    description: 'Identificadores das estações a vincular ao contrato',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  estacaoIds!: string[];
}
