import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EstacoesController } from './estacoes.controller';
import { EstacoesService } from './estacoes.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UsuariosModule],
  controllers: [EstacoesController],
  providers: [EstacoesService, GuardaAdministrador],
})
export class EstacoesModule {}
