/* eslint-disable max-lines, complexity */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
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
import type {
  AuthUser,
  LoginResult,
  MfaSetup,
  MfaSetupVerified,
  MfaStatus,
  SessionSummary,
  TokenPair,
  UserSummary,
} from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { DisableMfaDto, MfaCodeDto, VerifyMfaChallengeDto, VerifyMfaSetupDto } from './dto/mfa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupDto } from './dto/setup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { OAuthProfile } from './types/oauth.types';

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
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ data: LoginResult }> {
    return this.authService.login(dto, this.requestMetadata(req)).then((data) => ({ data }));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<{ data: TokenPair }> {
    return this.authService
      .refresh(dto.refreshToken, this.requestMetadata(req))
      .then((data) => ({ data }));
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

  @Get('mfa')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current MFA status' })
  async mfaStatus(@CurrentUser() user: AuthUser): Promise<{ data: MfaStatus }> {
    return { data: await this.authService.mfaStatus(user.id) };
  }

  @Post('mfa/setup')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start TOTP MFA setup' })
  async beginMfaSetup(@CurrentUser() user: AuthUser): Promise<{ data: MfaSetup }> {
    return { data: await this.authService.beginMfaSetup(user.id) };
  }

  @Post('mfa/verify-setup')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and enable TOTP MFA' })
  verifyMfaSetup(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyMfaSetupDto,
  ): Promise<{ data: MfaSetupVerified }> {
    return this.authService
      .verifyMfaSetup(user.id, dto.secret, dto.code)
      .then((data) => ({ data }));
  }

  @Post('mfa/challenge')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900000 } })
  @ApiOperation({ summary: 'Complete a password-verified MFA login challenge' })
  completeMfaChallenge(
    @Body() dto: VerifyMfaChallengeDto,
    @Req() req: Request,
  ): Promise<{ data: TokenPair }> {
    return this.authService
      .completeMfaChallenge(dto.challengeToken, dto.code, this.requestMetadata(req))
      .then((data) => ({ data }));
  }

  @Post('mfa/recovery-codes')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate MFA recovery codes' })
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ data: { recoveryCodes: string[] } }> {
    return this.authService.regenerateRecoveryCodes(user.id, dto.code).then((data) => ({ data }));
  }

  @Delete('mfa')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA for the current user' })
  disableMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableMfaDto,
  ): Promise<{ data: MfaStatus }> {
    return this.authService
      .disableMfa(user.id, dto.currentPassword, dto.code)
      .then((data) => ({ data }));
  }

  @Get('sessions')
  @Authenticated()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active refresh-token sessions' })
  listSessions(@CurrentUser() user: AuthUser): Promise<{ data: SessionSummary[] }> {
    return this.authService.listSessions(user.id).then((data) => ({ data }));
  }

  @Delete('sessions/:id')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke one active refresh-token session' })
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.authService.revokeSession(user.id, id);
  }

  @Delete('sessions')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all active refresh-token sessions for the current user' })
  revokeAllSessions(@CurrentUser() user: AuthUser): Promise<{ data: { revoked: number } }> {
    return this.authService.revokeAllSessions(user.id).then((data) => ({ data }));
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

  @Get('oauth/oidc')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Initiate generic OIDC login' })
  async oidcLogin(@Res() res: Response): Promise<void> {
    const cfg = this.oidcConfig();
    const target = new URL(cfg.authorizationUrl);
    target.searchParams.set('response_type', 'code');
    target.searchParams.set('client_id', cfg.clientId);
    target.searchParams.set('redirect_uri', cfg.redirectUri);
    target.searchParams.set('scope', cfg.scopes);
    target.searchParams.set('state', await this.authService.issueOAuthState('oidc'));
    res.redirect(target.toString());
  }

  @Get('oauth/oidc/callback')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Generic OIDC callback' })
  async oidcCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) throw new BadRequestException('OIDC code and state are required');
    await this.authService.consumeOAuthState('oidc', state);
    const token = await this.exchangeOidcCode(code);
    const profile = await this.loadOidcProfile(token);
    await this.redirectWithCode(await this.authService.oauthCallback('oidc', profile), res);
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

  private requestMetadata(req: Request): { userAgent?: string; ipAddress?: string } {
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip;
    return {
      ...(userAgent ? { userAgent } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    };
  }

  private oidcConfig(): {
    authorizationUrl: string;
    tokenUrl: string;
    userinfoUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
  } {
    const clientId = this.configService.get('OIDC_CLIENT_ID', { infer: true }) ?? '';
    const clientSecret = this.configService.get('OIDC_CLIENT_SECRET', { infer: true }) ?? '';
    const authorizationUrl =
      this.configService.get('OIDC_AUTHORIZATION_URL', { infer: true }) ?? '';
    const tokenUrl = this.configService.get('OIDC_TOKEN_URL', { infer: true }) ?? '';
    const userinfoUrl = this.configService.get('OIDC_USERINFO_URL', { infer: true }) ?? '';
    if (!clientId || !clientSecret || !authorizationUrl || !tokenUrl || !userinfoUrl) {
      throw new BadRequestException('OIDC is not configured');
    }
    return {
      authorizationUrl,
      tokenUrl,
      userinfoUrl,
      clientId,
      clientSecret,
      redirectUri: `${this.configService.get('SITE_URL', { infer: true })}/api/v1/auth/oauth/oidc/callback`,
      scopes: this.configService.get('OIDC_SCOPES', { infer: true }) ?? 'openid email profile',
    };
  }

  private async exchangeOidcCode(code: string): Promise<string> {
    const cfg = this.oidcConfig();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
    const response = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = (await response.json()) as { access_token?: unknown };
    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new BadRequestException('OIDC token exchange failed');
    }
    return payload.access_token;
  }

  private async loadOidcProfile(accessToken: string): Promise<OAuthProfile> {
    const cfg = this.oidcConfig();
    const response = await fetch(cfg.userinfoUrl, {
      headers: { Accept: 'application/json', Authorization: 'Bearer '.concat(accessToken) },
    });
    const info = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof info['sub'] !== 'string') {
      throw new BadRequestException('OIDC userinfo lookup failed');
    }
    const email = typeof info['email'] === 'string' ? info['email'] : undefined;
    const name = typeof info['name'] === 'string' ? info['name'] : undefined;
    const givenName = typeof info['given_name'] === 'string' ? info['given_name'] : undefined;
    const familyName = typeof info['family_name'] === 'string' ? info['family_name'] : undefined;
    return {
      id: info['sub'],
      provider: 'oidc',
      ...(name ? { displayName: name } : {}),
      name: {
        ...(givenName ? { givenName } : {}),
        ...(familyName ? { familyName } : {}),
      },
      ...(email ? { emails: [{ value: email, verified: info['email_verified'] === true }] } : {}),
      ...(typeof info['picture'] === 'string' ? { photos: [{ value: info['picture'] }] } : {}),
    };
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
