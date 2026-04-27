import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser, TokenPair, UserSummary } from '../../common/types/auth.types';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 20, ttl: 900000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto): Promise<{ data: TokenPair }> {
    return this.authService.login(dto).then((data) => ({ data }));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ public: { limit: 60, ttl: 60000 } })
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
  async googleCallback(
    @Req() req: Request & { user?: TokenPair },
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    return this.redirectWithTokens(req.user, state, res);
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
    @Req() req: Request & { user?: TokenPair },
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    return this.redirectWithTokens(req.user, state, res);
  }

  // ─── Password Reset ───────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private redirectWithTokens(
    tokenPair: TokenPair | undefined,
    _state: string | undefined,
    res: Response,
  ): void {
    if (!tokenPair) throw new BadRequestException('OAuth authentication failed');
    const { accessToken, refreshToken } = tokenPair;
    const params = new URLSearchParams({ accessToken, refreshToken });
    res.redirect(`/oauth-callback?${params.toString()}`);
  }
}
