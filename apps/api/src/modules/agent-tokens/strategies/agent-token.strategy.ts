import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport';
import type { AuthUser } from '../../../common/types/auth.types';
import { AgentTokenRepository } from '../agent-token.repository';

@Injectable()
export class AgentTokenStrategy extends PassportStrategy(Strategy, 'agent-token') {
  constructor(private readonly agentTokenRepo: AgentTokenRepository) {
    super({ passReqToCallback: true });
  }

  override async authenticate(req: Request): Promise<void> {
    const self = this as unknown as {
      fail(info: object, status: number): void;
      success(user: unknown): void;
    };
    try {
      const user = await this.extractAndValidate(req);
      if (!user) {
        self.fail({ message: 'No agent token' }, 401);
        return;
      }
      self.success(user);
    } catch {
      self.fail({ message: 'Invalid agent token' }, 401);
    }
  }

  private async extractAndValidate(req: Request): Promise<AuthUser | null> {
    const raw = this.extractRaw(req);
    if (!raw) return null;

    const record = await this.agentTokenRepo.findForAuth(raw);
    if (!record?.user.isActive) {
      throw new UnauthorizedException('Invalid agent token');
    }

    this.agentTokenRepo.updateLastUsed(record.id);

    const scopes = Array.isArray(record.scope) ? (record.scope as string[]) : [];
    return {
      id: record.user.id,
      email: record.user.email,
      roles: record.user.roles.map((ur) => ur.role.name),
      isAgentToken: true,
      agentTokenId: record.id,
      agentTokenScopes: scopes,
    };
  }

  private extractRaw(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer kastagent_')) {
      return auth.slice(7);
    }
    return null;
  }
}
