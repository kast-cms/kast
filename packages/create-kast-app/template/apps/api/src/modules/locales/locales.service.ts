import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Locale } from '@prisma/client';
import type { CreateLocaleDto, UpdateLocaleDto } from './dto/locale.dto';
import { LocalesRepository } from './locales.repository';

@Injectable()
export class LocalesService {
  constructor(private readonly repo: LocalesRepository) {}

  findAll(): Promise<Locale[]> {
    return this.repo.findAll();
  }

  async create(dto: CreateLocaleDto): Promise<Locale> {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictException(`Locale "${dto.code}" already exists`);

    if (dto.fallbackCode !== undefined) {
      const fallback = await this.repo.findByCode(dto.fallbackCode);
      if (!fallback) throw new NotFoundException(`Fallback locale "${dto.fallbackCode}" not found`);
    }

    return this.repo.create(dto);
  }

  async update(code: string, dto: UpdateLocaleDto): Promise<Locale> {
    const locale = await this.repo.findByCode(code);
    if (!locale) throw new NotFoundException(`Locale "${code}" not found`);

    if (dto.fallbackCode !== undefined) {
      if (dto.fallbackCode === code) {
        throw new BadRequestException('A locale cannot be its own fallback');
      }
      const fallback = await this.repo.findByCode(dto.fallbackCode);
      if (!fallback) throw new NotFoundException(`Fallback locale "${dto.fallbackCode}" not found`);
    }

    return this.repo.update(code, dto);
  }

  async setDefault(code: string): Promise<Locale> {
    const locale = await this.repo.findByCode(code);
    if (!locale) throw new NotFoundException(`Locale "${code}" not found`);
    return this.repo.setDefault(code);
  }

  async delete(code: string): Promise<void> {
    const locale = await this.repo.findByCode(code);
    if (!locale) throw new NotFoundException(`Locale "${code}" not found`);
    if (locale.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default locale. Set another locale as default first.',
      );
    }
    await this.repo.delete(code);
  }
}
