import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { McpService } from './mcp.service';
import { McpSessionStore } from './mcp.session';
import type { McpRequest } from './types/mcp.types';

@ApiTags('mcp')
@ApiBearerAuth()
@Controller({ path: 'mcp', version: '1' })
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly sessionStore: McpSessionStore,
  ) {}

  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE transport endpoint' })
  openSse(@Req() req: Request, @Res() res: Response, @CurrentUser() _user: AuthUser): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sessionId = this.sessionStore.create(res);
    const welcomeEvent = { type: 'session', sessionId };
    res.write(`event: message\ndata: ${JSON.stringify(welcomeEvent)}\n\n`);

    req.on('close', () => {
      this.sessionStore.remove(sessionId);
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MCP JSON-RPC endpoint' })
  async handleRpc(@Body() body: McpRequest, @CurrentUser() user: AuthUser): Promise<unknown> {
    return this.mcpService.handle(body, user);
  }
}
