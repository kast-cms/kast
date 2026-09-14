import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser, LoginResult, TokenPair, UserSummary } from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupDto } from './dto/setup.dto';
import { VerifyTwoFactorDto } from './dto/two-factor.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OidcService } from './oidc.service';
import { requestMetadata } from './request-metadata';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Env>,
    private readonly oidc: OidcService,
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
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ data: LoginResult }> {
    return this.authService.login(dto, requestMetadata(req)).then((data) => ({ data }));
  }

  @Post('two-factor/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyTwoFactor(@Body() dto: VerifyTwoFactorDto): Promise<{ data: TokenPair }> {
    return { data: await this.authService.verifyTwoFactor(dto.challengeToken, dto.code) };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<{ data: TokenPair }> {
    return this.authService.refresh(dto.refreshToken).then((data) => ({ data }));
  }

  /**
   * Public on purpose: the refresh token in the body is itself the credential
   * being surrendered, and it is the only one the admin holds at logout — the
   * access token lives in browser memory the route handler cannot read. Behind
   * a bearer guard this answered 401 and the server-side token stayed valid.
   */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: AuthUser): Promise<{ data: UserSummary }> {
    return this.authService.me(user.id).then((data) => ({ data }));
  }

  @Patch('me')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ data: UserSummary }> {
    return this.authService.updateProfile(user.id, dto).then((data) => ({ data }));
  }

  // ─── OAuth ───────────────────────────────────────────────────

  @Get('providers')
  @Public()
  providers(): { data: { google: boolean; github: boolean; oidc: boolean } } {
    return {
      data: {
        google: Boolean(
          this.configService.get('GOOGLE_CLIENT_ID') &&
          this.configService.get('GOOGLE_CLIENT_SECRET'),
        ),
        github: Boolean(
          this.configService.get('GITHUB_CLIENT_ID') &&
          this.configService.get('GITHUB_CLIENT_SECRET'),
        ),
        oidc: this.oidc.enabled(),
      },
    };
  }

  @Get('oauth/oidc')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async oidcLogin(@Res() res: Response): Promise<void> {
    const { state, url } = await this.oidc.start();
    res.cookie('kast_oidc_state', state, {
      httpOnly: true,
      secure: this.oidc.callbackUrl().startsWith('https:'),
      sameSite: 'lax',
      path: '/api/v1/auth/oauth/oidc/callback',
      maxAge: 300_000,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(url);
  }

  @Get('oauth/oidc/callback')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async oidcCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const browserState = req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('kast_oidc_state='))
      ?.slice('kast_oidc_state='.length);
    res.clearCookie('kast_oidc_state', { path: '/api/v1/auth/oauth/oidc/callback' });
    const url = new URL(this.oidc.callbackUrl());
    url.search = new URL(req.originalUrl, url.origin).search;
    const profile = await this.oidc.callback(url, browserState);
    await this.redirectWithCode(
      await this.authService.oauthCallback(this.oidc.providerKey(), profile, requestMetadata(req)),
      res,
    );
  }

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
  async googleCallback(
    @Req() req: Request & { user?: LoginResult },
    @Res() res: Response,
  ): Promise<void> {
    await this.redirectWithCode(req.user, res);
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
  async githubCallback(
    @Req() req: Request & { user?: LoginResult },
    @Res() res: Response,
  ): Promise<void> {
    await this.redirectWithCode(req.user, res);
  }

  @Post('oauth/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange a single-use OAuth authorization code for tokens' })
  exchangeOAuthCode(@Body('code') code: unknown): Promise<{ data: LoginResult }> {
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

  @Post('accept-invite')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Set the first password for an invited account' })
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<{ message: string }> {
    await this.authService.acceptInvite(dto.token, dto.password);
    return { message: 'Invitation accepted. You can now sign in.' };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private async redirectWithCode(tokenPair: LoginResult | undefined, res: Response): Promise<void> {
    if (!tokenPair) throw new BadRequestException('OAuth authentication failed');
    const target = this.adminCallbackUrl();
    target.searchParams.set('code', await this.authService.issueOAuthAuthorizationCode(tokenPair));
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
