import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AlarmesController } from './alarmes.controller';
import { AlarmesService } from './alarmes.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AlarmesController],
  providers: [AlarmesService],
})
export class AlarmesModule {}
