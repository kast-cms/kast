import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) => {
        const host = configService.get('REDIS_HOST', { infer: true }) ?? 'localhost';
        const port = configService.get('REDIS_PORT', { infer: true }) ?? 6379;
        const password = configService.get('REDIS_PASSWORD', { infer: true });
        return {
          connection: {
            host,
            port,
            ...(password ? { password } : {}),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.WEBHOOK },
      { name: QUEUE_NAMES.MEDIA },
      { name: QUEUE_NAMES.SEO },
      { name: QUEUE_NAMES.PUBLISH },
      { name: QUEUE_NAMES.AUDIT },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.TRASH },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
