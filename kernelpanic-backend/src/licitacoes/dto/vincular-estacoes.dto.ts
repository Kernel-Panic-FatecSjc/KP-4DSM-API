import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class VincularEstacoesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    description: 'Estações que passam a pertencer à licitação',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  estacaoIds!: string[];
}
