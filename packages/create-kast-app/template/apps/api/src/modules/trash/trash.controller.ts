import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import {
  TRASH_MODELS,
  TrashQueryDto,
  type TrashListResult,
  type TrashModel,
} from './dto/trash-query.dto';
import { TrashService } from './trash.service';

@ApiTags('trash')
@Controller({ path: 'trash', version: '1' })
@ApiBearerAuth()
export class TrashController {
  constructor(private readonly service: TrashService) {}

  @Get()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List trashed items' })
  list(@Query() query: TrashQueryDto): Promise<TrashListResult> {
    return this.service.list(query);
  }

  @Post(':model/:id/restore')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a trashed item',
    description:
      'Restoring a user reactivates the account, so it is refused for a target ranked at or above the caller.',
  })
  restore(
    @Param('model') model: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    this.assertValidModel(model);
    return this.service.restore(model as TrashModel, id, user);
  }

  @Delete(':model/:id')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a trashed item (SUPER_ADMIN only)' })
  async permanentDelete(
    @Param('model') model: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    this.assertValidModel(model);
    await this.service.permanentDelete(model as TrashModel, id, user);
  }

  private assertValidModel(model: string): void {
    if (!(TRASH_MODELS as readonly string[]).includes(model)) {
      throw new BadRequestException(
        `Invalid model: ${model}. Must be one of: ${TRASH_MODELS.join(', ')}`,
      );
    }
  }
}
