import { Injectable } from '@nestjs/common';
import type { MediaFile, Prisma } from '@prisma/client';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto): Promise<{ items: MediaFile[]; total: number }> {
    const limit = query.limit ?? 20;
    const where: Prisma.MediaFileWhereInput = { trashedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.mediaFile.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<MediaFile | null> {
    return this.prisma.mediaFile.findFirst({ where: { id, trashedAt: null } });
  }

  create(data: Prisma.MediaFileCreateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.create({ data });
  }

  update(id: string, data: Prisma.MediaFileUpdateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<MediaFile> {
    return this.prisma.mediaFile.update({ where: { id }, data: { trashedAt: new Date() } });
  }
}
