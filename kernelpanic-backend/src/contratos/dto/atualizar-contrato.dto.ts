import { PartialType } from '@nestjs/swagger';
import { CriarContratoDto } from './criar-contrato.dto';

export class AtualizarContratoDto extends PartialType(CriarContratoDto) {}
