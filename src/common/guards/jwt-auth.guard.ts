import {
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: Error | undefined,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      const name = info?.name ?? err?.name ?? '';
      const msg = info?.message ?? err?.message ?? '';
      if (
        name === 'TokenExpiredError' ||
        /expired/i.test(msg) ||
        /jwt expired/i.test(msg)
      ) {
        throw new UnauthorizedException(
          'Sessão expirada. Faça login novamente.',
        );
      }
      if (
        name === 'JsonWebTokenError' ||
        /invalid token/i.test(msg) ||
        /jwt malformed/i.test(msg)
      ) {
        throw new UnauthorizedException(
          'Token inválido. Faça login novamente.',
        );
      }
      throw (
        err ||
        new UnauthorizedException('Não autenticado. Faça login novamente.')
      );
    }
    return user;
  }
}
