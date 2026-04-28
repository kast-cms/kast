import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  providers: [EmailProcessor],
  exports: [EmailProcessor],
})
export class EmailModule {}
