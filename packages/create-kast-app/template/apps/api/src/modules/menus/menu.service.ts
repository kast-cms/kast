import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Menu, MenuItem } from '@prisma/client';
import type {
  CreateMenuDto,
  CreateMenuItemDto,
  ReorderMenuItemsDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import { MenuRepository, type MenuDetail, type MenuSummary } from './menu.repository';

@Injectable()
export class MenuService {
  constructor(private readonly repo: MenuRepository) {}

  list(): Promise<MenuSummary[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<MenuDetail> {
    const menu = await this.repo.findById(id);
    if (!menu) throw new NotFoundException(`Menu ${id} not found`);
    return menu;
  }

  async findBySlug(slug: string): Promise<MenuDetail> {
    const menu = await this.repo.findBySlug(slug);
    if (!menu) throw new NotFoundException(`Menu "${slug}" not found`);
    return menu;
  }

  async create(dto: CreateMenuDto): Promise<Menu> {
    try {
      return await this.repo.create(dto);
    } catch {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }
  }

  async update(id: string, dto: UpdateMenuDto): Promise<Menu> {
    await this.findOne(id);
    try {
      return await this.repo.update(id, dto);
    } catch {
      throw new ConflictException(`Slug is already in use`);
    }
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async addItem(menuId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    await this.findOne(menuId);
    return this.repo.createItem(menuId, dto);
  }

  async updateItem(menuId: string, itemId: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    await this.findOne(menuId);
    return this.repo.updateItem(itemId, dto);
  }

  async deleteItem(menuId: string, itemId: string): Promise<void> {
    await this.findOne(menuId);
    await this.repo.deleteItem(itemId);
  }

  async reorder(menuId: string, dto: ReorderMenuItemsDto): Promise<void> {
    await this.findOne(menuId);
    await this.repo.reorderItems(dto.items);
  }
}
