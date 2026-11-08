import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HEADER_CHAVE_INGESTAO } from './estacoes/chave-ingestao';

/** Configuração comum à API e às apps dos testes funcionais. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  configurarDocumentacao(app);
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar os hooks de
  // encerramento: na API fecham o LISTEN do tempo real e a conexão com o broker;
  // nos testes da ingestão, drenam o lote ainda em memória.
  app.enableShutdownHooks();
}

/** Swagger em /docs e o documento OpenAPI em /docs-json. Também usado pelos serviços de ingestão e tratamento. */
export function configurarDocumentacao(app: INestApplication): void {
  SwaggerModule.setup('docs', app, criarDocumentoOpenApi(app));
}

/** O documento OpenAPI 3 da app. Também usado por scripts/gerar-openapi.ts, que gera o arquivo sem subir o servidor. */
export function criarDocumentoOpenApi(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kernel Panic API')
    .setDescription(
      'API do DATA PANIC: dados meteorológicos, estações, alarmes e alertas. ' +
        'Rotas logadas usam o cookie JWT (faça POST /autenticacao/login nesta mesma página); ' +
        'a ingestão usa a chave da estação no header.',
    )
    .setVersion('1.0')
    .addServer('/', 'Servidor atual')
    .addTag('autenticacao', 'Login, logout e perfil da sessão.')
    .addTag('usuarios', 'Cadastro e gestão de usuários.')
    .addTag('licitacoes', 'Licitações, órgãos e vínculo de estações.')
    .addTag('estacoes', 'Estações meteorológicas e suas chaves de ingestão.')
    .addTag('sensores', 'Tipos de sensor (parâmetros) e unidades de medida.')
    .addTag('alertas', 'Regras de limite que geram alarmes.')
    .addTag('alarmes', 'Histórico de alarmes disparados.')
    .addTag('dashboard', 'Indicadores e séries de medições.')
    .addTag('relatorios', 'Relatórios consolidados de histórico climático.')
    .addTag('leituras-brutas', 'Pacotes recebidos dos dispositivos, sem tratamento.')
    .addTag('leituras-erro', 'Leituras recusadas pelo tratamento.')
    .addTag('auditoria', 'Trilha de auditoria das ações no sistema.')
    .addTag('dados-abertos', 'Dados públicos em JSON e CSV (e-PING), sem login.')
    .addTag('ingestao', 'Recebimento de telemetria das estações (serviço de ingestão).')
    .addTag('saude', 'Verificação de saúde dos serviços.')
    .addTag('aplicacao', 'Verificação de que a API responde.')
    .addCookieAuth(
      'access_token',
      { type: 'apiKey', in: 'cookie' },
      'access_token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: HEADER_CHAVE_INGESTAO },
      HEADER_CHAVE_INGESTAO,
    )
    .build();
  return SwaggerModule.createDocument(app, swaggerConfig);
}
