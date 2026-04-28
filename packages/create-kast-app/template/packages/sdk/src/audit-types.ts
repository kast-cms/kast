export interface AuditLogEntry {
  id: string;
  userId: string | null;
  agentTokenId: string | null;
  agentName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  isDryRun: boolean;
  createdAt: string;
}

export interface AuditLogListParams {
  action?: string;
  resource?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditLogMeta {
  total: number;
  limit: number;
  cursor: string | null;
  hasNextPage: boolean;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  meta: AuditLogMeta;
}
