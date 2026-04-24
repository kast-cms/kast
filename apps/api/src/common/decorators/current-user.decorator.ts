import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Request } from 'express';
import type { AuthUser } from '../types/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
