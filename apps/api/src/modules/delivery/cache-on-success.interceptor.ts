import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Applies a Cache-Control value only once the handler has produced a response.
 * `@Header()` writes its value before the handler runs, so a 404 or a transient
 * 5xx would carry it too and a CDN would pin the error for its whole lifetime.
 * Failures are marked no-store because 404 is heuristically cacheable otherwise.
 */
@Injectable()
export class CacheOnSuccessInterceptor implements NestInterceptor {
  constructor(private readonly value: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const setHeader = (value: string): void => {
      context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', value);
    };
    return next.handle().pipe(
      tap({
        next: () => setHeader(this.value),
        error: () => setHeader('no-store'),
      }),
    );
  }
}
