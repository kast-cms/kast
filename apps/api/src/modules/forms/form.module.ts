import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FormController } from './form.controller';
import { FormRepository } from './form.repository';
import { FormService } from './form.service';

@Module({
  imports: [PrismaModule],
  controllers: [FormController],
  providers: [FormService, FormRepository],
  exports: [FormService],
})
export class FormModule {}
