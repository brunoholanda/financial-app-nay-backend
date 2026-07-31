import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  RATE_LIMIT_CODE,
  RATE_LIMIT_MESSAGE,
  clientIp,
} from '../rate-limit.options';

/**
 * Excesso de chamadas responde 429 no mesmo formato dos outros erros da API
 * (mensagem em português e `code`), com `Retry-After` em segundos para o cliente
 * saber quando voltar.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RateLimitGuard.name);

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    // A biblioteca devolve os tempos já em segundos.
    const retryAfter = Math.max(
      1,
      detail.timeToBlockExpire || detail.timeToExpire,
    );

    res.header('Retry-After', String(retryAfter));
    this.logger.warn(
      `Limite atingido por ${clientIp(req)} em ${req.method} ${req.path}: ` +
        `${detail.totalHits} chamadas para um limite de ${detail.limit} em ${detail.ttl / 1000}s`,
    );

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: RATE_LIMIT_MESSAGE,
        code: RATE_LIMIT_CODE,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
