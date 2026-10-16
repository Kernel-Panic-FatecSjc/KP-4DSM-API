import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { StatusContrato } from '../../generated/prisma/client';

export class ListarContratosQueryDto {
  @ApiProperty({ enum: StatusContrato, required: false })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @ApiProperty({ example: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e', required: false })
  @IsOptional()
  @IsUUID('4')
  orgaoId?: string;

  @ApiProperty({ example: 'CTR-2026', required: false })
  @IsOptional()
  @IsString()
  busca?: string;
}