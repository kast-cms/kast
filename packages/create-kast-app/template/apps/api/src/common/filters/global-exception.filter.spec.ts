import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ArgumentsHost, HttpArgumentsHost } from '@nestjs/common/interfaces';
import type { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionFilter } from './global-exception.filter';

interface CapturedBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

function run(exception: unknown): { body: CapturedBody; status: number } {
  const reply = jest.fn();
  const host = {
    switchToHttp: () =>
      ({
        getRequest: () => ({ url: '/api/v1/thing', method: 'POST' }),
        getResponse: () => ({}),
      }) as unknown as HttpArgumentsHost,
  } as ArgumentsHost;

  const filter = new GlobalExceptionFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);
  void filter.catch(exception, host);

  const [, body, status] = reply.mock.calls[0] as [unknown, CapturedBody, number];
  return { body, status };
}

describe('GlobalExceptionFilter', () => {
  describe('machine-readable code passthrough', () => {
    it('keeps a code the exception body names', () => {
      const { body } = run(
        new BadRequestException({
          message: "Content validation failed for 'blog_post': title is required",
          code: 'CONTENT_VALIDATION_FAILED',
        }),
      );

      expect(body.error.code).toBe('CONTENT_VALIDATION_FAILED');
      expect(body.error.statusCode).toBe(400);
    });

    it('keeps a 422 state code rather than flattening it to UNPROCESSABLE', () => {
      const { body } = run(
        new UnprocessableEntityException({
          message: 'stored data no longer satisfies the schema',
          code: 'VERSION_INCOMPATIBLE_WITH_SCHEMA',
        }),
      );

      expect(body.error.code).toBe('VERSION_INCOMPATIBLE_WITH_SCHEMA');
      expect(body.error.statusCode).toBe(422);
    });

    it('keeps an authorization denial code so a client can branch on the reason', () => {
      const { body } = run(
        new ForbiddenException({
          code: 'TOKEN_SCOPE_DENIED',
          message: 'This API token is not scoped for media:create',
        }),
      );

      expect(body.error.code).toBe('TOKEN_SCOPE_DENIED');
      expect(body.error.message).toBe('This API token is not scoped for media:create');
    });

    it('falls back to the status-derived code for a plain Nest exception', () => {
      const { body } = run(new NotFoundException('Entry not found'));

      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Entry not found');
    });

    it('falls back for a ValidationPipe failure, whose body carries no code', () => {
      const { body } = run(
        new BadRequestException({
          message: ['property config should not exist'],
          error: 'Bad Request',
          statusCode: 400,
        }),
      );

      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('property config should not exist');
    });

    it('ignores a non-string code rather than letting it displace the fallback', () => {
      const { body } = run(new BadRequestException({ message: 'nope', code: 42 }));

      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ignores an empty-string code', () => {
      const { body } = run(new BadRequestException({ message: 'nope', code: '' }));

      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('structured detail passthrough', () => {
    it('surfaces a per-field errors array as details', () => {
      const issues = [{ field: 'title', message: 'title is required' }];
      const { body } = run(
        new BadRequestException({
          message: 'Content validation failed',
          code: 'CONTENT_VALIDATION_FAILED',
          errors: issues,
        }),
      );

      expect(body.error.details).toEqual(issues);
    });

    it('omits details when the exception carries none', () => {
      const { body } = run(new NotFoundException('nope'));

      expect(body.error).not.toHaveProperty('details');
    });
  });
});
