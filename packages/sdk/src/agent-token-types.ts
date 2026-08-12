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

export interface AgentSessionSummary {
  id: string;
  agentName: string | null;
  toolsUsed: string[];
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: string | null;
}
