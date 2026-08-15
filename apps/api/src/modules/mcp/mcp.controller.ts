import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { McpService } from './mcp.service';

@ApiTags('mcp')
@ApiBearerAuth()
@Controller({ path: 'mcp', version: '1' })
@Authenticated()
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @All()
  @ApiOperation({ summary: 'MCP Streamable HTTP endpoint' })
  handle(@Req() req: Request, @Res() res: Response, @CurrentUser() user: AuthUser): Promise<void> {
    return this.mcpService.handleHttp(req, res, user);
  }
}
