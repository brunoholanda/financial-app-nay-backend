import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    // Código de negócio opcional (ex.: etapas do 2FA) para o cliente reagir.
    let code: string | undefined;
    // Campos extras da exceção (ex.: cota de documentos no 403 do limite).
    const extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        message =
          (body.message as string | string[] | undefined) ?? exception.message;
        code = typeof body.code === 'string' ? body.code : undefined;
        const skip = new Set(['statusCode', 'error', 'message', 'code']);
        for (const [key, value] of Object.entries(body)) {
          if (!skip.has(key)) {
            extra[key] = value;
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      ...(code ? { code } : {}),
      ...extra,
    });
  }
}
