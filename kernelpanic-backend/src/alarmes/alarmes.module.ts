import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AlarmesController } from './alarmes.controller';
import { AlarmesService } from './alarmes.service';
import { AlarmesGateway } from './tempo-real/alarmes.gateway';
import { AlarmesTempoRealService } from './tempo-real/alarmes-tempo-real.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AutenticacaoModule, UsuariosModule],
  controllers: [AlarmesController],
  providers: [AlarmesService, AlarmesGateway, AlarmesTempoRealService],
})
export class AlarmesModule {}
