import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';

@ApiTags('queue-board')
@ApiBearerAuth()
@Controller({ path: 'queue-board', version: '1' })
export class QueueBoardSessionController {
  constructor(private readonly configService: ConfigService<Env>) {}

  @Post('session')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Create an HTTP-only session for the embedded Bull Board' })
  createSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthUser,
  ): void {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    // JwtAuthGuard already verified this credential. Refuse to mint a cookie
    // from API-key or agent-token authentication, neither of which is a JWT.
    if (!token || user.isApiToken || user.isAgentToken) {
      throw new ForbiddenException('Queue Board sessions require an interactive user JWT');
    }

    const production = this.configService.get('NODE_ENV', { infer: true }) === 'production';
    res.cookie('kast_bull', token, {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/api/bull-board',
    });
  }
}
