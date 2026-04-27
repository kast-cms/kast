import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateFormDto,
  ListSubmissionsQueryDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/form.dto';
import type { FormRow, FormWithFields, PaginatedSubmissions } from './form.repository';
import { FormService } from './form.service';

@ApiTags('forms')
@Controller({ path: 'forms', version: '1' })
export class FormController {
  constructor(private readonly service: FormService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all forms' })
  list(): Promise<FormRow[]> {
    return this.service.list();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a form' })
  create(@Body() dto: CreateFormDto): Promise<FormWithFields> {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a form definition' })
  findOne(@Param('id') id: string): Promise<FormWithFields> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a form' })
  update(@Param('id') id: string, @Body() dto: UpdateFormDto): Promise<FormWithFields> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a form' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Post(':id/submit')
  @Public()
  @Throttle({ public: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a form (public, rate limited 10/min per IP)' })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitFormDto,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    await this.service.submit(id, dto, ip, ua);
    return { ok: true };
  }

  @Get(':id/submissions/export')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export submissions as CSV' })
  async exportCsv(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const csv = await this.service.exportCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="submissions-${id}.csv"`);
    res.send(csv);
  }

  @Get(':id/submissions')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List form submissions' })
  getSubmissions(
    @Param('id') id: string,
    @Query() query: ListSubmissionsQueryDto,
  ): Promise<PaginatedSubmissions> {
    return this.service.getSubmissions(id, query);
  }

  @Delete(':id/submissions/:subId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a submission' })
  async deleteSubmission(@Param('id') id: string, @Param('subId') subId: string): Promise<void> {
    await this.service.deleteSubmission(id, subId);
  }
}
