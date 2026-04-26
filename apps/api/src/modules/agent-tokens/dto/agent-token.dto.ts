import { IsArray, IsString, MinLength } from 'class-validator';

export class CreateAgentTokenDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsString({ each: true })
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
