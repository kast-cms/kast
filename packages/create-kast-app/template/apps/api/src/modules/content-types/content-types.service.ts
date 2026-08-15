import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ContentField } from '@prisma/client';
import {
  ContentTypesRepository,
  ContentTypeWithCounts,
  ContentTypeWithFields,
} from './content-types.repository';
import type {
  CreateContentTypeDto,
  CreateFieldDto,
  ReorderFieldsDto,
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

  findAll(): Promise<ContentTypeWithCounts[]> {
    return this.repo.findAll();
  }

  findPubliclyDiscoverable(): Promise<ContentTypeWithFields[]> {
    return this.repo.findPubliclyDiscoverable();
  }

  async findPubliclyDiscoverableByName(name: string): Promise<ContentTypeWithFields> {
    const ct = await this.repo.findPubliclyDiscoverableByName(name);
    if (!ct) throw new NotFoundException(`Public content type '${name}' not found`);
    return ct;
  }

  async findByName(name: string): Promise<ContentTypeWithFields> {
    const ct = await this.repo.findByName(name);
    if (!ct) throw new NotFoundException(`Content type '${name}' not found`);
    return ct;
  }

  async findDetailByName(name: string): Promise<ContentTypeWithCounts> {
    const ct = await this.repo.findByNameWithCounts(name);
    if (!ct) throw new NotFoundException(`Content type '${name}' not found`);
    return ct;
  }

  async create(dto: CreateContentTypeDto): Promise<ContentTypeWithCounts> {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException(`Content type '${dto.name}' already exists`);
    return this.repo.create({
      name: dto.name,
      displayName: dto.displayName,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      // Entry writes branch on this at runtime, so a type created through the API
      // has to be able to declare it.
      isLocalized: dto.isLocalized ?? false,
      isPubliclyDiscoverable: dto.isPubliclyDiscoverable ?? false,
    });
  }

  async previewCreate(dto: CreateContentTypeDto): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException(`Content type '${dto.name}' already exists`);
    return {
      ...dto,
      isLocalized: dto.isLocalized ?? false,
      isPubliclyDiscoverable: dto.isPubliclyDiscoverable ?? false,
    };
  }

  async update(name: string, dto: UpdateContentTypeDto): Promise<ContentTypeWithCounts> {
    await this.findByName(name);
    return this.repo.update(name, dto);
  }

  async previewUpdate(name: string, dto: UpdateContentTypeDto): Promise<Record<string, unknown>> {
    await this.findByName(name);
    return { name, ...dto };
  }

  /**
   * Rewrites every field position from the supplied name order. The order has to
   * name each field on the type exactly once, so a stale client cannot drop a
   * field that another editor added between load and drop.
   */
  async reorderFields(typeName: string, dto: ReorderFieldsDto): Promise<ContentTypeWithCounts> {
    const ct = await this.findByName(typeName);
    const byName = new Map(ct.fields.map((f) => [f.name, f]));

    if (new Set(dto.order).size !== dto.order.length) {
      throw new BadRequestException('order must not repeat a field name');
    }
    if (dto.order.length !== ct.fields.length) {
      throw new BadRequestException(
        `order must list all ${ct.fields.length} fields of '${typeName}', got ${dto.order.length}`,
      );
    }
    const ids: string[] = [];
    for (const fieldName of dto.order) {
      const field = byName.get(fieldName);
      if (!field) {
        throw new NotFoundException(`Field '${fieldName}' not found on '${typeName}'`);
      }
      ids.push(field.id);
    }

    await this.repo.reorderFields(ids);
    return this.findDetailByName(typeName);
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
