import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocalesController } from './locales.controller';
import { LocalesRepository } from './locales.repository';
import { LocalesService } from './locales.service';

@Module({
  imports: [PrismaModule],
  controllers: [LocalesController],
  providers: [LocalesService, LocalesRepository],
  exports: [LocalesRepository],
})
export class LocalesModule {}
