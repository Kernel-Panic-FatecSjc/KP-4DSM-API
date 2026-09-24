import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SensoresController } from './sensores.controller';
import { SensoresService } from './sensores.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [SensoresController],
  providers: [SensoresService],
})
export class SensoresModule {}
