import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
