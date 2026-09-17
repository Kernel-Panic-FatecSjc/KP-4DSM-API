import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('dashboard')
@UseGuards(GuardaJwt)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  buscarDados(@Query() query: DashboardQueryDto) {
    return this.dashboardService.buscarDados(query);
  }
}