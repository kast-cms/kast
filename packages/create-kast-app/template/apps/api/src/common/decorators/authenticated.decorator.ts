import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_KEY = 'authenticated-only';
export const Authenticated = (): ClassDecorator & MethodDecorator =>
  SetMetadata(AUTHENTICATED_KEY, true);
