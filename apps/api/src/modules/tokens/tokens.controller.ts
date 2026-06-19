import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import {
  type ApiTokenCreatedResponse,
  type ApiTokenSummaryResponse,
  CreateApiTokenDto,
} from './dto/token.dto';
import { TokensService } from './tokens.service';

@ApiTags('tokens')
@ApiBearerAuth()
@Controller({ path: 'tokens', version: '1' })
export class TokensController {
  constructor(private readonly service: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'List API tokens for the current user' })
  list(@CurrentUser() user: AuthUser): Promise<PaginatedResult<ApiTokenSummaryResponse>> {
    return this.service.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an API token (plaintext returned once)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiTokenDto,
  ): Promise<{ data: ApiTokenCreatedResponse }> {
    return this.service.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API token' })
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.service.revoke(id, user.id);
  }
}
