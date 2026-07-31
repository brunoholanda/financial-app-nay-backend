import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

/** Vírgula ou ponto e vírgula; aspas e espaços são removidos (evita "CORS Missing Allow Origin" por typo no .env). */
function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return DEFAULT_CORS_ORIGINS;
  }
  const list = raw
    .split(/[,;]+/g)
    .map((o) =>
      o
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/[>\]]+$/g, '')
        .trim(),
    )
    .filter((o) => o.length > 0 && /^https?:\/\/.+/i.test(o));
  return list.length > 0 ? [...new Set(list)] : DEFAULT_CORS_ORIGINS;
}

/**
 * Quantos proxies à frente do backend podem ser confiados no X-Forwarded-For.
 * Aceita número de saltos (`1`), lista de IPs/faixas ou apelidos do Express
 * (`loopback`). Sem isso o rate limit contaria o IP do proxy, e com `true`
 * qualquer cliente poderia forjar o cabeçalho e escapar do limite.
 */
function parseTrustProxy(raw: string | undefined): number | string | undefined {
  const value = raw?.trim();
  if (!value || value === 'false') return undefined;
  // `true` cru aceitaria X-Forwarded-For forjado; um salto cobre o caso comum.
  if (value === 'true') return 1;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

const API_DESCRIPTION = `API do painel Financeiro.

Não é uma API aberta: todo endpoint de dados exige um token de um usuário com
assinatura ativa. O token vem em duas etapas — \`POST /auth/login\` com e-mail e
senha dispara um código de 6 dígitos por e-mail, e \`POST /auth/login/verify\`
troca esse código pelo JWT que vai no cabeçalho \`Authorization: Bearer\`. Não
existe chave de máquina, credencial de aplicação nem fluxo OAuth.

Os endpoints ligados a um espaço de trabalho (lançamentos, contas, documentos,
seguros, investimentos) exigem também o cabeçalho \`x-workspace-id\` com o espaço
escolhido. Sem assinatura válida, essas rotas respondem 402.

Há limite de requisições por IP e por endpoint: ao estourar, a resposta é 429 com
o cabeçalho \`Retry-After\`. Rotas de gestão interna não estão documentadas aqui.

Suporte: contato@brunoholanda.com`;

/**
 * Especificação OpenAPI pública, anunciada em /.well-known/api-catalog no site.
 * Serve como documentação para quem integra e para agentes que descobrem a API
 * pelo catálogo. `API_DOCS_ENABLED=false` desliga tudo, caso preciso.
 */
function setupApiDocs(app: NestExpressApplication) {
  if (process.env.API_DOCS_ENABLED === 'false') return;

  const config = new DocumentBuilder()
    .setTitle('Financeiro API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0.0')
    .setContact(
      'Holanda Desenvolvimento de Software',
      'https://financial.brunoholanda.com/',
      'contato@brunoholanda.com',
    )
    .addServer(
      process.env.API_PUBLIC_URL ?? 'https://financial.api.brunoholanda.com',
      'API do Financeiro',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT devolvido por POST /auth/login/verify.',
    })
    .build();

  // A especificação é pública; sem isso, só as origens do CORS conseguiriam
  // lê-la pelo navegador (editores de OpenAPI e agentes ficariam de fora).
  app.use(
    ['/openapi.json', '/openapi.yaml'],
    (_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      // Curinga e credenciais juntos são recusados pelo navegador; a leitura
      // aqui é anônima, então o cabeçalho de credenciais sai da resposta.
      res.removeHeader('Access-Control-Allow-Credentials');
      next();
    },
  );

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
    yamlDocumentUrl: 'openapi.yaml',
    customSiteTitle: 'Financeiro API',
    swaggerOptions: { persistAuthorization: true },
  });
  new Logger('Bootstrap').log('documentação da API em /docs e /openapi.json');
}

async function bootstrap() {
  // rawBody é necessário para validar a assinatura do webhook do Stripe.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
    new Logger('Bootstrap').log(`trust proxy: ${String(trustProxy)}`);
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  const origins = parseCorsOrigins(process.env.CORS_ORIGIN);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Accept-Language',
      'X-Requested-With',
      'x-workspace-id',
      'If-Modified-Since',
    ],
    exposedHeaders: ['Content-Length'],
  });
  setupApiDocs(app);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
