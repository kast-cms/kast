import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ContentField } from '@prisma/client';
import { ContentTypesRepository, ContentTypeWithFields } from './content-types.repository';
import type {
  CreateContentTypeDto,
  CreateFieldDto,
  UpdateContentTypeDto,
  UpdateFieldDto,
} from './dto/content-type.dto';

/** Narrows a validated DTO value to what Prisma accepts for a non-null `Json` column. */
function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

/**
 * Same for a nullable `Json` column. Prisma needs the `DbNull` sentinel to store
 * a SQL NULL — a bare `null` would be read as "leave unchanged" on update.
 */
function toNullableJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

@Injectable()
export class ContentTypesService {
  constructor(private readonly repo: ContentTypesRepository) {}

  findAll(): Promise<ContentTypeWithFields[]> {
    return this.repo.findAll();
  }

  async findByName(name: string): Promise<ContentTypeWithFields> {
    const ct = await this.repo.findByName(name);
    if (!ct) throw new NotFoundException(`Content type '${name}' not found`);
    return ct;
  }

  async create(dto: CreateContentTypeDto): Promise<ContentTypeWithFields> {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException(`Content type '${dto.name}' already exists`);
    return this.repo.create({
      name: dto.name,
      displayName: dto.displayName,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
    });
  }

  async update(name: string, dto: UpdateContentTypeDto): Promise<ContentTypeWithFields> {
    await this.findByName(name);
    return this.repo.update(name, dto);
  }

  async delete(name: string): Promise<void> {
    await this.findByName(name);
    await this.repo.delete(name);
  }

  async createField(typeName: string, dto: CreateFieldDto): Promise<ContentField> {
    const ct = await this.findByName(typeName);
    const existing = await this.repo.findFieldByNameAndType(ct.id, dto.name);
    if (existing)
      throw new ConflictException(`Field '${dto.name}' already exists on '${typeName}'`);
    return this.repo.createField({
      name: dto.name,
      displayName: dto.displayName,
      type: dto.type,
      isRequired: dto.isRequired ?? false,
      isLocalized: dto.isLocalized ?? false,
      isUnique: dto.isUnique ?? false,
      isHidden: dto.isHidden ?? false,
      position: dto.position ?? 0,
      // `config` drives the per-field validation rules the content write gate
      // enforces (minLength, regex, choices, allowedMimeTypes, ...). Dropping it
      // here left every API-created field with an empty rule set.
      config: toJsonInput(dto.config) ?? {},
      ...(dto.defaultValue !== undefined
        ? { defaultValue: toNullableJsonInput(dto.defaultValue) }
        : {}),
      contentType: { connect: { id: ct.id } },
    });
  }

  async updateField(
    typeName: string,
    fieldName: string,
    dto: UpdateFieldDto,
  ): Promise<ContentField> {
    const ct = await this.findByName(typeName);
    const field = await this.repo.findFieldByNameAndType(ct.id, fieldName);
    if (!field) throw new NotFoundException(`Field '${fieldName}' not found on '${typeName}'`);
    const { config, defaultValue, ...rest } = dto;
    return this.repo.updateField(field.id, {
      ...rest,
      // An omitted key leaves the stored value alone; an explicit one replaces it.
      ...(config !== undefined ? { config: toJsonInput(config) ?? {} } : {}),
      ...(defaultValue !== undefined ? { defaultValue: toNullableJsonInput(defaultValue) } : {}),
    });
  }

  async deleteField(typeName: string, fieldName: string): Promise<void> {
    const ct = await this.findByName(typeName);
    const field = await this.repo.findFieldByNameAndType(ct.id, fieldName);
    if (!field) throw new NotFoundException(`Field '${fieldName}' not found on '${typeName}'`);
    await this.repo.deleteField(field.id);
  }
}
