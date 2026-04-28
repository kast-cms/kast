import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

export const AuditAction = (action: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(AUDIT_ACTION_KEY, action);
