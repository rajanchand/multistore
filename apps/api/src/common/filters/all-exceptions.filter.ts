import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Centralised exception handling. Produces the standard error envelope:
 * { error: { code, message, requestId } } — never stack traces.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { requestId?: string }).requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === 'string' ? b.message : Array.isArray(b.message) ? b.message.join('; ') : message;
        code = typeof b.code === 'string' ? b.code : defaultCodeFor(status);
        details = b.details;
      }
      if (code === 'INTERNAL_ERROR') code = defaultCodeFor(status);
    } else {
      // Unknown error: log fully server-side, return generic message.
      this.logger.error(
        `Unhandled exception [${requestId}]: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status} [${requestId}] ${message}`);
    }

    response.status(status).json({
      error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
    });
  }
}

function defaultCodeFor(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_FAILED';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
