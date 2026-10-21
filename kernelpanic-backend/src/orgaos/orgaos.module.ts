import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OrgaosController } from './orgaos.controller';
import { OrgaosService } from './orgaos.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsuariosModule,
  ],
  controllers: [OrgaosController],
  providers: [OrgaosService, GuardaAdministrador],
})
export class OrgaosModule {}
