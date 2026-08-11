import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ContentValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns id -> mimeType for the media files that exist and are not trashed. */
  async findLiveMedia(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.mediaFile.findMany({
      where: { id: { in: ids }, trashedAt: null },
      select: { id: true, mimeType: true },
    });
    return new Map(rows.map((r) => [r.id, r.mimeType]));
  }

  /** Returns id -> contentTypeId for the entries that exist and are not trashed. */
  async findLiveEntryTypes(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.contentEntry.findMany({
      where: { id: { in: ids }, trashedAt: null },
      select: { id: true, contentTypeId: true },
    });
    return new Map(rows.map((r) => [r.id, r.contentTypeId]));
  }

  /** Returns name -> id for the requested content types. */
  async findContentTypeIdsByName(names: string[]): Promise<Map<string, string>> {
    if (names.length === 0) return new Map();
    const rows = await this.prisma.contentType.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.name, r.id]));
  }
}
