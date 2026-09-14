import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { toDataURL } from 'qrcode';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { AuthRepository } from './auth.repository';
import { TwoFactorCodeDto } from './dto/two-factor.dto';
import type { SessionSummary } from './session.repository';
import { TwoFactorService } from './two-factor.service';

type Data<T> = Promise<{ data: T }>;

@ApiTags('auth')
@ApiBearerAuth()
@Authenticated()
@Controller({ path: 'auth', version: '1' })
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AccountSecurityController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly repo: AuthRepository,
  ) {}

  private interactive(user: AuthUser): string {
    if (user.isApiToken || user.isAgentToken || !user.sessionId)
      throw new ForbiddenException('Sign in to manage account security');
    return user.sessionId;
  }

  @Get('two-factor')
  @Header('Cache-Control', 'no-store')
  async status(
    @CurrentUser() user: AuthUser,
  ): Data<Awaited<ReturnType<TwoFactorService['status']>>> {
    this.interactive(user);
    return { data: await this.twoFactor.status(user.id) };
  }

  @Post('two-factor/setup')
  @Header('Cache-Control', 'no-store')
  async setup(
    @CurrentUser() user: AuthUser,
  ): Data<{ secret: string; otpauthUri: string; qrCode: string }> {
    const sessionId = this.interactive(user);
    const session = await this.repo.findActiveSession(sessionId, user.id);
    if (!session || Date.now() - session.createdAt.getTime() > 600_000)
      throw new ForbiddenException(
        'Please sign in again before setting up two-factor authentication',
      );
    const setup = await this.twoFactor.setup(user.id);
    return { data: { ...setup, qrCode: await toDataURL(setup.otpauthUri) } };
  }

  @Post('two-factor/enable')
  @Header('Cache-Control', 'no-store')
  async enable(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ): Data<{ recoveryCodes: string[] }> {
    return { data: await this.twoFactor.enable(user.id, dto.code, this.interactive(user)) };
  }

  @Post('two-factor/disable')
  async disable(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ): Data<{ enabled: false }> {
    await this.twoFactor.disable(user.id, dto.code, this.interactive(user));
    return { data: { enabled: false } };
  }

  @Post('two-factor/recovery-codes')
  @Header('Cache-Control', 'no-store')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ): Data<{ recoveryCodes: string[] }> {
    return { data: await this.twoFactor.regenerate(user.id, dto.code, this.interactive(user)) };
  }

  @Get('sessions')
  @Header('Cache-Control', 'no-store')
  async sessions(@CurrentUser() user: AuthUser): Data<(SessionSummary & { current: boolean })[]> {
    const current = this.interactive(user);
    return {
      data: (await this.repo.listSessions(user.id)).map((session) => ({
        ...session,
        current: session.id === current,
      })),
    };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    this.interactive(user);
    await this.repo.revokeSession(user.id, id);
  }

  @Delete('sessions')
  async revokeAll(@CurrentUser() user: AuthUser): Data<{ revoked: number }> {
    this.interactive(user);
    const result = await this.repo.revokeAllRefreshTokensForUser(user.id);
    return { data: { revoked: result.count } };
  }
}
