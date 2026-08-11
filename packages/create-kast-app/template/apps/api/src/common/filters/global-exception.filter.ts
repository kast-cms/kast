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
    /**
     * Structured, per-item detail (e.g. content-schema field errors, SEO gate
     * issues). Present only when the thrown exception supplied it.
     */
    details?: unknown;
  };
}

/**
 * Keys an HttpException body may use to carry structured detail alongside the
 * flat `message`. Without this passthrough the filter reduced every exception
 * to a single string, so per-field validation results were only ever readable
 * by parsing the flattened message.
 */
const DETAIL_KEYS = ['errors', 'details', 'issues'] as const;

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

    const { statusCode, code, message, details } = this.resolveException(exception);

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
        ...(details !== undefined ? { details } : {}),
      },
    };

    httpAdapter.reply(ctx.getResponse<Response>(), body, statusCode);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
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
      const details = this.extractDetails(response);
      return {
        statusCode: status,
        // An exception that names its own machine-readable code keeps it, so a
        // client can branch on e.g. CONTENT_VALIDATION_FAILED or TOKEN_SCOPE_DENIED
        // instead of string-matching the message. Nest's built-in exceptions and
        // ValidationPipe carry no `code`, so they still fall back to the status.
        code: this.extractCode(response) ?? this.httpStatusToCode(status),
        message,
        ...(details !== undefined ? { details } : {}),
      };
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

  /**
   * Pulls an explicit machine-readable code from an exception body. Only a
   * non-empty string is honoured, so a stray `code` of another shape (e.g. a
   * numeric driver code) cannot displace the status-derived fallback.
   */
  private extractCode(response: unknown): string | undefined {
    if (typeof response !== 'object' || response === null) return undefined;
    const value = (response as Record<string, unknown>).code;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /** Pulls the first structured detail payload an exception body carries. */
  private extractDetails(response: unknown): unknown {
    if (typeof response !== 'object' || response === null) return undefined;
    const record = response as Record<string, unknown>;
    for (const key of DETAIL_KEYS) {
      const value = record[key];
      if (value !== undefined) return value;
    }
    return undefined;
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
