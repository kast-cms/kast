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

/** One MCP tool invocation. The transport is stateless, so there is no session. */
export interface AgentToolCallSummary {
  id: string;
  agentName: string | null;
  toolName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: string | null;
}
