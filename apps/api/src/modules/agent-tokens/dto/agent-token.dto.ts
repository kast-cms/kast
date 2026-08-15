import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsString, MinLength } from 'class-validator';
import { MCP_TOOL_NAMES } from '../../mcp/mcp-tool-catalog';

export class CreateAgentTokenDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(MCP_TOOL_NAMES, { each: true })
  scopes!: string[];
}

export interface AgentTokenRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AgentTokenCreatedResponse {
  token: string;
  record: AgentTokenRecord;
}
