import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // padrão do driver "pg" é 10 — baixo demais para o volume de
        // ingestão em lote (visto no teste de carga: o pool, não o Postgres
        // em si, era o teto real de requisições/s).
        max: Number(process.env.DATABASE_POOL_MAX ?? 30),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
