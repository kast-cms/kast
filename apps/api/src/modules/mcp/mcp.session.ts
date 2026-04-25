import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

interface McpSession {
  id: string;
  res: Response;
  createdAt: Date;
}

@Injectable()
export class McpSessionStore {
  private readonly sessions = new Map<string, McpSession>();

  create(res: Response): string {
    const id = randomUUID();
    this.sessions.set(id, { id, res, createdAt: new Date() });
    return id;
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  send(id: string, data: unknown): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.res.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }
}
