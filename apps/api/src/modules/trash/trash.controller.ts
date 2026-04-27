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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TRASH_MODELS,
  TrashQueryDto,
  type TrashedItemDto,
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
  list(@Query() query: TrashQueryDto): Promise<{ items: TrashedItemDto[]; total: number }> {
    return this.service.list(query);
  }

  @Post(':model/:id/restore')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a trashed item' })
  restore(
    @Param('model') model: string,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    this.assertValidModel(model);
    const userId = (req.user as { id: string }).id;
    return this.service.restore(model as TrashModel, id, userId);
  }

  @Delete(':model/:id')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a trashed item (SUPER_ADMIN only)' })
  async permanentDelete(
    @Param('model') model: string,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    this.assertValidModel(model);
    const userId = (req.user as { id: string }).id;
    await this.service.permanentDelete(model as TrashModel, id, userId);
  }

  private assertValidModel(model: string): void {
    if (!(TRASH_MODELS as readonly string[]).includes(model)) {
      throw new BadRequestException(
        `Invalid model: ${model}. Must be one of: ${TRASH_MODELS.join(', ')}`,
      );
    }
  }
}
