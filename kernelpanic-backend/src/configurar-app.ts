import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Valor do "trust proxy" do Express a partir de TRUST_PROXY. Atrás de um proxy
 * reverso, sem isso request.ip é o IP do proxy, e a trilha de auditoria (e o
 * limite de requisições) veria todo mundo com o mesmo endereço. Só confie no
 * X-Forwarded-For de proxies seus: um número de saltos ("1") ou a lista de
 * endereços/sub-redes do Express ("loopback", "10.0.0.0/8"). Vazio = não confia
 * (padrão), e o cabeçalho enviado pelo cliente é ignorado.
 */
export function valorTrustProxy(valor: string | undefined): number | string | undefined {
  const texto = valor?.trim();
  if (!texto || texto === 'false') return undefined;
  if (/^\d+$/.test(texto)) return Number(texto);
  return texto;
}

/** Configuração comum à API e às apps dos testes funcionais. */
export function configurarApp(app: INestApplication): void {
  const trustProxy = valorTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kernel Panic API')
    .setDescription('API do sistema DATA PANIC')
    .setVersion('1.0')
    .addCookieAuth(
      'access_token',
      { type: 'apiKey', in: 'cookie' },
      'access_token',
    )
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar os hooks de
  // encerramento: na API fecham o LISTEN do tempo real e a conexão com o broker;
  // nos testes da ingestão, drenam o lote ainda em memória.
  app.enableShutdownHooks();
}
