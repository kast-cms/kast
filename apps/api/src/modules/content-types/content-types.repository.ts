import { Injectable } from '@nestjs/common';
import type { ContentField, ContentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ContentTypeWithFields = ContentType & { fields: ContentField[] };

@Injectable()
export class ContentTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ContentTypeWithFields[]> {
    return this.prisma.contentType.findMany({
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByName(name: string): Promise<ContentTypeWithFields | null> {
    return this.prisma.contentType.findUnique({
      where: { name },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  create(data: Prisma.ContentTypeCreateInput): Promise<ContentTypeWithFields> {
    return this.prisma.contentType.create({
      data,
      include: { fields: true },
    });
  }

  update(name: string, data: Prisma.ContentTypeUpdateInput): Promise<ContentTypeWithFields> {
    return this.prisma.contentType.update({
      where: { name },
      data,
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  delete(name: string): Promise<ContentType> {
    return this.prisma.contentType.delete({ where: { name } });
  }

  createField(data: Prisma.ContentFieldCreateInput): Promise<ContentField> {
    return this.prisma.contentField.create({ data });
  }

  updateField(id: string, data: Prisma.ContentFieldUpdateInput): Promise<ContentField> {
    return this.prisma.contentField.update({ where: { id }, data });
  }

  findFieldByNameAndType(contentTypeId: string, name: string): Promise<ContentField | null> {
    return this.prisma.contentField.findUnique({
      where: { contentTypeId_name: { contentTypeId, name } },
    });
  }

  deleteField(id: string): Promise<ContentField> {
    return this.prisma.contentField.delete({ where: { id } });
  }
}
