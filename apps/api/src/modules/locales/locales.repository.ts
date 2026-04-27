import { Injectable } from '@nestjs/common';
import type { Locale } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLocaleDto, UpdateLocaleDto } from './dto/locale.dto';

@Injectable()
export class LocalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Locale[]> {
    return this.prisma.locale.findMany({ orderBy: { createdAt: 'asc' } });
  }

  findByCode(code: string): Promise<Locale | null> {
    return this.prisma.locale.findUnique({ where: { code } });
  }

  findActive(): Promise<Locale[]> {
    return this.prisma.locale.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findDefault(): Promise<Locale | null> {
    return this.prisma.locale.findFirst({ where: { isDefault: true } });
  }

  create(dto: CreateLocaleDto): Promise<Locale> {
    return this.prisma.locale.create({
      data: {
        code: dto.code,
        name: dto.name,
        nativeName: dto.nativeName,
        direction: dto.direction ?? 'LTR',
        ...(dto.fallbackCode !== undefined ? { fallbackCode: dto.fallbackCode } : {}),
      },
    });
  }

  update(code: string, dto: UpdateLocaleDto): Promise<Locale> {
    return this.prisma.locale.update({
      where: { code },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nativeName !== undefined ? { nativeName: dto.nativeName } : {}),
        ...(dto.direction !== undefined ? { direction: dto.direction } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.fallbackCode !== undefined ? { fallbackCode: dto.fallbackCode } : {}),
      },
    });
  }

  async setDefault(code: string): Promise<Locale> {
    await this.prisma.locale.updateMany({ data: { isDefault: false } });
    return this.prisma.locale.update({ where: { code }, data: { isDefault: true } });
  }

  async delete(code: string): Promise<void> {
    await this.prisma.locale.delete({ where: { code } });
  }
}
