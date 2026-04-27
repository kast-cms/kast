import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { AgentTokenService } from './agent-token.service';
import {
  type AgentTokenCreatedResponse,
  type AgentTokenRecord,
  CreateAgentTokenDto,
} from './dto/agent-token.dto';

@ApiTags('agent-tokens')
@Controller({ path: 'agent-tokens', version: '1' })
@ApiBearerAuth()
export class AgentTokenController {
  constructor(private readonly service: AgentTokenService) {}

  @Get()
  @ApiOperation({ summary: 'List agent tokens for current user' })
  list(@CurrentUser() user: AuthUser): Promise<{ data: AgentTokenRecord[] }> {
    return this.service.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an agent token' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAgentTokenDto,
  ): Promise<{ data: AgentTokenCreatedResponse }> {
    return this.service.create(user.id, dto.name, dto.scopes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an agent token' })
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.service.revoke(id, user.id);
  }
}
