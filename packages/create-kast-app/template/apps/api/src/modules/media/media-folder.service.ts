import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/types/auth.types';
import { MediaRepository, type FolderWithCounts } from './media.repository';

export interface MediaFolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  filesCount: number;
  children: MediaFolderResponse[];
}

@Injectable()
export class MediaFolderService {
  constructor(private readonly repo: MediaRepository) {}

  private toNode(row: FolderWithCounts): MediaFolderResponse {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      filesCount: row._count.files,
      children: [],
    };
  }

  async list(): Promise<PaginatedResult<MediaFolderResponse>> {
    const rows = await this.repo.listFolders();
    const nodes = new Map<string, MediaFolderResponse>();
    for (const row of rows) nodes.set(row.id, this.toNode(row));
    const roots: MediaFolderResponse[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return {
      data: roots,
      meta: { total: rows.length, limit: rows.length, cursor: null, hasNextPage: false },
    };
  }

  async create(name: string, parentId?: string): Promise<{ data: MediaFolderResponse }> {
    if (parentId) {
      const parent = await this.repo.findFolderById(parentId);
      if (!parent) throw new NotFoundException(`Parent folder ${parentId} not found`);
    }
    const folder = await this.repo.createFolder(name, parentId ?? null);
    return {
      data: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        filesCount: 0,
        children: [],
      },
    };
  }

  async update(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<{ data: MediaFolderResponse }> {
    const folder = await this.repo.findFolderById(id);
    if (!folder) throw new NotFoundException(`Folder ${id} not found`);
    if (data.parentId) {
      if (data.parentId === id) throw new BadRequestException('A folder cannot be its own parent');
      const parent = await this.repo.findFolderById(data.parentId);
      if (!parent) throw new NotFoundException(`Parent folder ${data.parentId} not found`);
    }
    const updated = await this.repo.updateFolder(id, data);
    return {
      data: {
        id: updated.id,
        name: updated.name,
        parentId: updated.parentId,
        filesCount: folder._count.files,
        children: [],
      },
    };
  }

  async delete(id: string): Promise<void> {
    const folder = await this.repo.findFolderById(id);
    if (!folder) throw new NotFoundException(`Folder ${id} not found`);
    if (folder._count.files > 0 || folder._count.children > 0) {
      throw new UnprocessableEntityException('Folder is not empty');
    }
    await this.repo.deleteFolder(id);
  }
}
