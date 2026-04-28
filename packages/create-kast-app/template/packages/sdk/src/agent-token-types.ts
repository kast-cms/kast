export interface AgentTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AgentTokenCreated extends AgentTokenSummary {
  token: string;
}

export interface CreateAgentTokenBody {
  name: string;
  scopes: string[];
}
