import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MenuController } from './menu.controller';
import { MenuRepository } from './menu.repository';
import { MenuService } from './menu.service';

@Module({
  imports: [PrismaModule],
  controllers: [MenuController],
  providers: [MenuService, MenuRepository],
  exports: [MenuService],
})
export class MenuModule {}
