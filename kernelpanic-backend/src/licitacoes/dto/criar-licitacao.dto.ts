import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { EsferaOrgao, ModalidadeLicitacao, StatusLicitacao } from '../../generated/prisma/client';
import { IsCnpj } from './cnpj.validator';

function aparar({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function maiusculas({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CriarLicitacaoDto {
  @ApiProperty({ example: 'PMSJC-2026', description: 'Código curto da licitação: letras, números e hífen' })
  @Transform(maiusculas)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,39}$/, {
    message: 'codigoIdentificador deve ter de 2 a 40 letras, números ou hífens',
  })
  codigoIdentificador!: string;

  @ApiProperty({ example: '0123/2026' })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroProcesso!: string;

  @ApiProperty({ enum: ModalidadeLicitacao })
  @IsEnum(ModalidadeLicitacao)
  modalidade!: ModalidadeLicitacao;

  @ApiProperty({ example: 'Monitoramento pluviométrico municipal', maxLength: 2000 })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  objeto!: string;

  @ApiProperty({ example: 'CTR-2026-001' })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroContrato!: string;

  @ApiProperty({
    example: '2026-01-01',
    format: 'date',
    description: 'Data sem horário significa meia-noite UTC; data-hora sem fuso é interpretada como UTC.',
  })
  @IsDateString()
  inicioVigencia!: string;

  @ApiProperty({
    example: '2026-12-31',
    format: 'date',
    description: 'Data sem horário inclui o dia inteiro até 23:59:59.999 UTC.',
  })
  @IsDateString()
  fimVigencia!: string;

  @ApiPropertyOptional({ enum: StatusLicitacao, default: StatusLicitacao.RASCUNHO })
  @IsOptional()
  @IsEnum(StatusLicitacao)
  status?: StatusLicitacao;

  @ApiProperty({ example: 'Prefeitura Municipal de São José dos Campos' })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  orgaoNome!: string;

  @ApiPropertyOptional({ example: '11.222.333/0001-81', nullable: true })
  @IsOptional()
  @IsString()
  @IsCnpj({ message: 'orgaoCnpj deve ser válido' })
  orgaoCnpj?: string | null;

  @ApiProperty({ enum: EsferaOrgao })
  @IsEnum(EsferaOrgao)
  orgaoEsfera!: EsferaOrgao;

  @ApiProperty({ example: 'São José dos Campos' })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  orgaoMunicipio!: string;

  @ApiProperty({ example: 'SP' })
  @Transform(maiusculas)
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'orgaoUf deve ser a sigla da UF' })
  orgaoUf!: string;
}
