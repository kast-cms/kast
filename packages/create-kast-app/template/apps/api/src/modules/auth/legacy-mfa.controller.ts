import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser, TokenPair } from '../../common/types/auth.types';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { DisableMfaDto, VerifyMfaSetupDto } from './dto/mfa.dto';
import { TwoFactorCodeDto, VerifyTwoFactorDto } from './dto/two-factor.dto';
import { TwoFactorService } from './two-factor.service';

type Status = { enabled: boolean; enabledAt: string | null; recoveryCodeCount: number };
/** Compatibility routes for clients released before the account-security page. */
@Controller({ path: 'auth/mfa', version: '1' })
@Authenticated()
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class LegacyMfaController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly repo: AuthRepository,
    private readonly auth: AuthService,
  ) {}
  private session(user: AuthUser): string {
    if (!user.sessionId || user.isApiToken || user.isAgentToken)
      throw new ForbiddenException('Sign in to manage account security');
    return user.sessionId;
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  async status(@CurrentUser() user: AuthUser): Promise<{ data: Status }> {
    this.session(user);
    const status = await this.twoFactor.status(user.id);
    const account = await this.repo.findUserById(user.id);
    return {
      data: {
        enabled: status.enabled,
        enabledAt: account?.mfaEnabledAt?.toISOString() ?? null,
        recoveryCodeCount: status.recoveryCodesRemaining,
      },
    };
  }
  @Post('setup')
  @Header('Cache-Control', 'no-store')
  async setup(
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: { secret: string; otpauthUrl: string } }> {
    const session = await this.repo.findActiveSession(this.session(user), user.id);
    if (!session || Date.now() - session.createdAt.getTime() > 600_000)
      throw new ForbiddenException(
        'Please sign in again before setting up two-factor authentication',
      );
    const setup = await this.twoFactor.setup(user.id);
    return { data: { secret: setup.secret, otpauthUrl: setup.otpauthUri } };
  }
  @Post('verify-setup')
  @Header('Cache-Control', 'no-store')
  async enable(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyMfaSetupDto,
  ): Promise<{ data: { enabled: true; recoveryCodes: string[] } }> {
    return {
      data: {
        enabled: true,
        ...(await this.twoFactor.enable(user.id, dto.code, this.session(user))),
      },
    };
  }
  @Post('challenge')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async challenge(@Body() dto: VerifyTwoFactorDto): Promise<{ data: TokenPair }> {
    return { data: await this.auth.verifyTwoFactor(dto.challengeToken, dto.code) };
  }
  @Post('recovery-codes')
  @Header('Cache-Control', 'no-store')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ data: { recoveryCodes: string[] } }> {
    return { data: await this.twoFactor.regenerate(user.id, dto.code, this.session(user)) };
  }
  @Delete()
  async disable(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableMfaDto,
  ): Promise<{ data: Status }> {
    const session = this.session(user);
    const account = await this.repo.findUserById(user.id);
    if (!account?.passwordHash || !(await argon2.verify(account.passwordHash, dto.currentPassword)))
      throw new UnauthorizedException('Current password is incorrect');
    await this.twoFactor.disable(user.id, dto.code, session);
    return { data: { enabled: false, enabledAt: null, recoveryCodeCount: 0 } };
  }
}
