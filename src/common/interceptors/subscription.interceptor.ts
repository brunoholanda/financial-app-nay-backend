import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, switchMap } from 'rxjs';
import { SubscriptionAccessService } from '../services/subscription-access.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/** Rotas que precisam funcionar mesmo sem licença válida. */
const OPEN_PREFIXES = ['/auth', '/billing', '/tickets', '/manager'];

/**
 * Depois do teste grátis, as rotas do app respondem 402 até a licença ser
 * regularizada. Login, assinatura, chamados e gestão seguem abertos: é por ali
 * que o usuário resolve a situação.
 */
@Injectable()
export class SubscriptionInterceptor implements NestInterceptor {
  constructor(private readonly access: SubscriptionAccessService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user?.sub) {
      return next.handle();
    }
    const path = req.path || req.url || '';
    if (OPEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next.handle();
    }

    return from(this.access.hasAccess(user)).pipe(
      switchMap((allowed) => {
        if (allowed) {
          return next.handle();
        }
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message:
              'Seu período de teste terminou. Assine a licença para continuar usando o app.',
            code: 'SUBSCRIPTION_REQUIRED',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }),
    );
  }
}
