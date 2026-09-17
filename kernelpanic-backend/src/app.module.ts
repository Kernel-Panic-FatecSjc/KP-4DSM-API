import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlarmesModule } from './alarmes/alarmes.module';
import { AlertasModule } from './alertas/alertas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutenticacaoModule } from './autenticacao/autenticacao.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsuariosModule,
    AutenticacaoModule,
    AlarmesModule,
    AlertasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
