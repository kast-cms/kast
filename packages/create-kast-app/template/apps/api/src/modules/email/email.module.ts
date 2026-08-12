import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SettingsModule } from '../settings/settings.module';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [ConfigModule, SettingsModule, BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  providers: [EmailProcessor],
  exports: [EmailProcessor],
})
export class EmailModule {}
