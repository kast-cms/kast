import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContentField } from '@prisma/client';
import { ContentTypesRepository, ContentTypeWithFields } from './content-types.repository';
import type {
  CreateContentTypeDto,
  CreateFieldDto,
  UpdateContentTypeDto,
  UpdateFieldDto,
} from './dto/content-type.dto';

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
      position: dto.position ?? 0,
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
    return this.repo.updateField(field.id, dto);
  }

  async deleteField(typeName: string, fieldName: string): Promise<void> {
    const ct = await this.findByName(typeName);
    const field = await this.repo.findFieldByNameAndType(ct.id, fieldName);
    if (!field) throw new NotFoundException(`Field '${fieldName}' not found on '${typeName}'`);
    await this.repo.deleteField(field.id);
  }
}
