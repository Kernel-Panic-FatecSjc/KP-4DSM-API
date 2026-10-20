import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração comum à API e às apps dos testes funcionais. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar o
  // onModuleDestroy, e o lote da ingestão ainda em memória se perde.
  app.enableShutdownHooks();
}
