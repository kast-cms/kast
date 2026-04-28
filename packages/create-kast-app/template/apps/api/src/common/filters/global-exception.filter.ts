import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly onError?: (err: unknown, context: Record<string, string>) => void,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const { statusCode, code, message } = this.resolveException(exception);

    if (statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      this.onError?.(exception, { path: request.url, method: request.method });
    }

    const body: ErrorResponse = {
      error: {
        code,
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    httpAdapter.reply(ctx.getResponse<Response>(), body, statusCode);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && 'message' in response
          ? Array.isArray((response as { message: unknown }).message)
            ? ((response as { message: string[] }).message[0] ?? exception.message)
            : String((response as { message: unknown }).message)
          : exception.message;
      return { statusCode: status, code: this.httpStatusToCode(status), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private resolvePrismaError(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    code: string;
    message: string;
  } {
    if (e.code === 'P2002') {
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'A record with this value already exists',
      };
    }
    if (e.code === 'P2025') {
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Record not found' };
    }
    return { statusCode: 422, code: 'UNPROCESSABLE', message: 'Database constraint violation' };
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
