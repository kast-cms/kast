import { Injectable } from '@nestjs/common';
import type { Menu, MenuItem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateMenuDto,
  CreateMenuItemDto,
  ReorderItemDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';

// ── Return types ───────────────────────────────────────────

export interface MenuSummary {
  id: string;
  name: string;
  slug: string;
  localeCode: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItemRecord extends MenuItem {
  children: MenuItemRecord[];
}

export interface MenuDetail {
  id: string;
  name: string;
  slug: string;
  localeCode: string | null;
  items: MenuItemRecord[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Repository ─────────────────────────────────────────────

@Injectable()
export class MenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MenuSummary[]> {
    const menus = await this.prisma.menu.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      localeCode: m.localeCode,
      itemCount: m._count.items,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async findById(id: string): Promise<MenuDetail | null> {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: { items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
    });
    if (!menu) return null;
    return { ...menu, items: buildTree(menu.items) };
  }

  async findBySlug(slug: string): Promise<MenuDetail | null> {
    const menu = await this.prisma.menu.findUnique({
      where: { slug },
      include: { items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
    });
    if (!menu) return null;
    return { ...menu, items: buildTree(menu.items) };
  }

  async create(dto: CreateMenuDto): Promise<Menu> {
    return this.prisma.menu.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        ...(dto.localeCode !== undefined ? { localeCode: dto.localeCode } : {}),
      },
    });
  }

  async update(id: string, dto: UpdateMenuDto): Promise<Menu> {
    return this.prisma.menu.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.localeCode !== undefined ? { localeCode: dto.localeCode } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.menu.delete({ where: { id } });
  }

  async createItem(menuId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    const position = dto.position ?? (await this.nextPosition(menuId, dto.parentId));
    return this.prisma.menuItem.create({
      data: {
        menuId,
        label: dto.label,
        position,
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.entryId !== undefined ? { entryId: dto.entryId } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async updateItem(itemId: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.entryId !== undefined ? { entryId: dto.entryId } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.prisma.menuItem.delete({ where: { id: itemId } });
  }

  async reorderItems(items: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.menuItem.update({
          where: { id: item.id },
          data: {
            position: item.order,
            ...(item.parentId !== undefined ? { parentId: item.parentId } : { parentId: null }),
          },
        }),
      ),
    );
  }

  private async nextPosition(menuId: string, parentId?: string): Promise<number> {
    const count = await this.prisma.menuItem.count({
      where: {
        menuId,
        parentId: parentId ?? null,
      },
    });
    return count;
  }
}

// ── Tree builder ───────────────────────────────────────────

function buildTree(flat: MenuItem[]): MenuItemRecord[] {
  const map = new Map<string, MenuItemRecord>();
  const roots: MenuItemRecord[] = [];

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of flat) {
    const node = map.get(item.id);
    if (!node) continue;
    if (item.parentId) {
      const parent = map.get(item.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}
