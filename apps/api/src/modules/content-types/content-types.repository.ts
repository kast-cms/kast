import { Injectable } from '@nestjs/common';
import type { ContentField, ContentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ContentTypeWithFields = ContentType & { fields: ContentField[] };

/** Adds the relation counts the management list/detail responses expose. */
export type ContentTypeWithCounts = ContentTypeWithFields & {
  _count: { fields: number; entries: number };
};

const COUNTS = { select: { fields: true, entries: true } } as const;

@Injectable()
export class ContentTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ContentTypeWithCounts[]> {
    return this.prisma.contentType.findMany({
      include: { fields: { orderBy: { position: 'asc' } }, _count: COUNTS },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPubliclyDiscoverable(): Promise<ContentTypeWithFields[]> {
    return this.prisma.contentType.findMany({
      where: { isPubliclyDiscoverable: true },
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPubliclyDiscoverableByName(name: string): Promise<ContentTypeWithFields | null> {
    return this.prisma.contentType.findFirst({
      where: { name, isPubliclyDiscoverable: true },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  /**
   * Counts are deliberately absent here: this is the hot lookup every content
   * write goes through. Use `findByNameWithCounts` for the management responses.
   */
  findByName(name: string): Promise<ContentTypeWithFields | null> {
    return this.prisma.contentType.findUnique({
      where: { name },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  findByNameWithCounts(name: string): Promise<ContentTypeWithCounts | null> {
    return this.prisma.contentType.findUnique({
      where: { name },
      include: { fields: { orderBy: { position: 'asc' } }, _count: COUNTS },
    });
  }

  create(data: Prisma.ContentTypeCreateInput): Promise<ContentTypeWithCounts> {
    return this.prisma.contentType.create({
      data,
      include: { fields: true, _count: COUNTS },
    });
  }

  update(name: string, data: Prisma.ContentTypeUpdateInput): Promise<ContentTypeWithCounts> {
    return this.prisma.contentType.update({
      where: { name },
      data,
      include: { fields: { orderBy: { position: 'asc' } }, _count: COUNTS },
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

  /**
   * Positions are rewritten as one transaction so a failed drag leaves the stored
   * order exactly as it was rather than half-applied.
   */
  async reorderFields(fieldIdsInOrder: string[]): Promise<void> {
    await this.prisma.$transaction(
      fieldIdsInOrder.map((id, index) =>
        this.prisma.contentField.update({ where: { id }, data: { position: index } }),
      ),
    );
  }
}
