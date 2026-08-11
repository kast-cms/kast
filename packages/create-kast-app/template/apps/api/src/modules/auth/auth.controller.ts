import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser, TokenPair, UserSummary } from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupDto } from './dto/setup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Env>,
  ) {}

  @Get('setup')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Whether the install still needs its first account' })
  async setupRequired(): Promise<{ data: { required: boolean } }> {
    return { data: { required: await this.authService.isSetupRequired() } };
  }

  @Post('setup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Create the first owner account on a fresh install' })
  async setup(@Body() dto: SetupDto): Promise<{ data: UserSummary }> {
    return { data: await this.authService.setup(dto) };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto): Promise<{ data: TokenPair }> {
    return this.authService.login(dto).then((data) => ({ data }));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<{ data: TokenPair }> {
    return this.authService.refresh(dto.refreshToken).then((data) => ({ data }));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: AuthUser): Promise<{ data: UserSummary }> {
    return this.authService.me(user.id).then((data) => ({ data }));
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ data: UserSummary }> {
    return this.authService.updateProfile(user.id, dto).then((data) => ({ data }));
  }

  // ─── OAuth ───────────────────────────────────────────────────

  @Get('oauth/google')
  @Public()
  @SkipThrottle()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleLogin(): void {
    // Passport redirects automatically
  }

  @Get('oauth/google/callback')
  @Public()
  @SkipThrottle()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(@Req() req: Request & { user?: TokenPair }, @Res() res: Response): void {
    this.redirectWithCode(req.user, res);
  }

  @Get('oauth/github')
  @Public()
  @SkipThrottle()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubLogin(): void {
    // Passport redirects automatically
  }

  @Get('oauth/github/callback')
  @Public()
  @SkipThrottle()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  githubCallback(@Req() req: Request & { user?: TokenPair }, @Res() res: Response): void {
    this.redirectWithCode(req.user, res);
  }

  @Post('oauth/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange a single-use OAuth authorization code for tokens' })
  exchangeOAuthCode(@Body('code') code: unknown): Promise<{ data: TokenPair }> {
    if (typeof code !== 'string' || code.length === 0) {
      throw new BadRequestException('code is required');
    }
    return this.authService.exchangeOAuthCode(code).then((data) => ({ data }));
  }

  // ─── Password Reset ───────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private redirectWithCode(tokenPair: TokenPair | undefined, res: Response): void {
    if (!tokenPair) throw new BadRequestException('OAuth authentication failed');
    const target = this.adminCallbackUrl();
    target.searchParams.set('code', this.authService.issueOAuthAuthorizationCode(tokenPair));
    res.redirect(target.toString());
  }

  /**
   * Absolute admin destination for the OAuth hop. ADMIN_URL carries the whole
   * public prefix of the admin app, so an admin mounted under a base path has
   * to be configured as e.g. https://cms.example.com/admin.
   */
  private adminCallbackUrl(): URL {
    const configured = this.configService.get('ADMIN_URL', { infer: true }) ?? '';
    let base: URL;
    try {
      base = new URL(configured);
    } catch {
      throw new InternalServerErrorException('ADMIN_URL is not a valid absolute URL');
    }
    if (base.protocol !== 'http:' && base.protocol !== 'https:') {
      throw new InternalServerErrorException('ADMIN_URL must use http or https');
    }
    return new URL(`${base.origin}${base.pathname.replace(/\/+$/, '')}/oauth-callback`);
  }
}
