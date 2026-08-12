import { BadRequestException, Controller, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueueAdapter } from './queue.adapter';
import { QUEUE_NAMES, type QueueName } from './queue.constants';

const REPLAYABLE_QUEUES = new Set<string>(Object.values(QUEUE_NAMES));

@ApiTags('queue-operations')
@ApiBearerAuth()
@Controller({ path: 'queue-operations', version: '1' })
export class QueueOpsController {
  constructor(private readonly queues: QueueAdapter) {}

  @Post(':name/replay-failed')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Replay retained failed jobs from a queue' })
  replayFailed(
    @Param('name') name: string,
    @Query('limit') rawLimit?: string,
  ): Promise<{ inspected: number; retried: number; errors: string[] }> {
    if (!REPLAYABLE_QUEUES.has(name)) throw new BadRequestException(`Unknown queue: ${name}`);
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new BadRequestException('limit must be an integer from 1 to 1000');
    }
    return this.queues.retryFailed(name as QueueName, limit);
  }
}
