import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TokensController } from './tokens.controller';
import { TokensRepository } from './tokens.repository';
import { TokensService } from './tokens.service';

@Module({
  imports: [PrismaModule],
  controllers: [TokensController],
  providers: [TokensService, TokensRepository],
  exports: [TokensService],
})
export class TokensModule {}
