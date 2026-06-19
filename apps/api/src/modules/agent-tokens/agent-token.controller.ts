import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import { AgentTokenService, type AgentSessionRecord } from './agent-token.service';
import {
  CreateAgentTokenDto,
  type AgentTokenCreatedResponse,
  type AgentTokenRecord,
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

  @Get(':id/sessions')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get MCP session history for an agent token' })
  sessions(
    @Param('id') id: string,
    @Query() query: PaginationDto,
  ): Promise<PaginatedResult<AgentSessionRecord>> {
    return this.service.listSessions(id, query.limit ?? 20, query.cursor);
  }
}
