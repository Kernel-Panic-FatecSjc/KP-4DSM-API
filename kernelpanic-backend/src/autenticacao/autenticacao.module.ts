import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AutenticacaoController } from './autenticacao.controller';
import { AutenticacaoService } from './autenticacao.service';
import { EstrategiaJwt } from './estrategia-jwt.strategy';

@Module({
  imports: [
    UsuariosModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '1h');
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn: expiresIn as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'] },
        };
      },
    }),
  ],
  controllers: [AutenticacaoController],
  providers: [AutenticacaoService, EstrategiaJwt],
  // JwtModule exportado para o websocket de alarmes validar o cookie no handshake.
  exports: [JwtModule],
})
export class AutenticacaoModule {}
