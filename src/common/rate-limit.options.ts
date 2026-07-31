import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * O webhook do Stripe chega em rajada (uma assinatura dispara vários eventos no
 * mesmo segundo) e já é autenticado pela assinatura HMAC — limitar aqui só
 * causaria reentrega.
 */
const UNLIMITED_PATHS = ['/billing/webhook'];

export const RATE_LIMIT_CODE = 'RATE_LIMITED';
export const RATE_LIMIT_MESSAGE =
  'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.';

/** Rajada: segura acessos simultâneos ao mesmo endpoint. */
const DEFAULT_BURST_TTL_SEC = 1;
const DEFAULT_BURST_LIMIT = 10;

/** Janela longa: segura uso abusivo sustentado do mesmo endpoint. */
const DEFAULT_WINDOW_TTL_SEC = 60;
const DEFAULT_WINDOW_LIMIT = 120;

/**
 * Quem está sendo contado. Atrás de proxy reverso, `req.ip` só é o IP real do
 * visitante se `TRUST_PROXY` estiver configurado (veja `main.ts`); sem isso o
 * Express devolve o IP do proxy e todos os clientes cairiam no mesmo balde.
 */
export function clientIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const raw = req.ip ?? req.socket?.remoteAddress ?? '';
  // Sockets dual-stack entregam IPv4 mapeado em IPv6 (::ffff:1.2.3.4).
  return raw.replace(/^::ffff:/, '') || 'desconhecido';
}

function positiveNumber(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const parsed = Number(config.get<string>(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Duas janelas por IP e por endpoint (a chave do throttler inclui controller e
 * handler): uma curta contra rajada e uma de um minuto contra abuso sustentado.
 * As duas valem ao mesmo tempo e podem ser afrouxadas rota a rota com
 * `@Throttle`.
 */
export function rateLimitOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  const disabled = config.get<string>('RATE_LIMIT_ENABLED') === 'false';

  return {
    errorMessage: RATE_LIMIT_MESSAGE,
    getTracker: (req) => clientIp(req),
    skipIf: (context: ExecutionContext) => {
      if (disabled || context.getType() !== 'http') return true;
      const path = context.switchToHttp().getRequest<Request>().path ?? '';
      return UNLIMITED_PATHS.some((prefix) => path.startsWith(prefix));
    },
    throttlers: [
      {
        name: 'burst',
        ttl:
          positiveNumber(
            config,
            'RATE_LIMIT_BURST_TTL_SEC',
            DEFAULT_BURST_TTL_SEC,
          ) * 1000,
        limit: positiveNumber(
          config,
          'RATE_LIMIT_BURST_LIMIT',
          DEFAULT_BURST_LIMIT,
        ),
      },
      {
        name: 'default',
        ttl:
          positiveNumber(config, 'RATE_LIMIT_TTL_SEC', DEFAULT_WINDOW_TTL_SEC) *
          1000,
        limit: positiveNumber(config, 'RATE_LIMIT_LIMIT', DEFAULT_WINDOW_LIMIT),
      },
    ],
  };
}
