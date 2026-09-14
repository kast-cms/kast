import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { createBullBoardAuthMiddleware } from './bull-board-auth.middleware';
import { QueueBoardSessionController } from './queue-board-session.controller';
import { QUEUE_NAMES } from './queue.constants';

@Module({
  imports: [
    BullBoardModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, PrismaService],
      useFactory: (configService: ConfigService<Env>, prisma: PrismaService) => ({
        route: '/bull-board',
        adapter: ExpressAdapter,
        middleware: createBullBoardAuthMiddleware(
          configService.get('JWT_SECRET', { infer: true }) ?? '',
          prisma,
        ),
      }),
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.WEBHOOK, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.MEDIA, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.SEO, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.PUBLISH, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.EMAIL, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.TRASH, adapter: BullMQAdapter },
    ),
  ],
  controllers: [QueueBoardSessionController],
})
export class QueueBoardModule {}
