import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}