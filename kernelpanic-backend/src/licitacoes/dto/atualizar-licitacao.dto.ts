import { PartialType } from '@nestjs/swagger';
import { CriarLicitacaoDto } from './criar-licitacao.dto';

export class AtualizarLicitacaoDto extends PartialType(CriarLicitacaoDto) {}
