import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContentTypesModule } from '../content-types/content-types.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';

@Module({
  imports: [ContentTypesModule, BullModule.registerQueue({ name: QUEUE_NAMES.PUBLISH })],
  controllers: [ContentController],
  providers: [ContentService, ContentRepository],
  exports: [ContentService],
})
export class ContentModule {}
