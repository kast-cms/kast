import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserListQueryDto } from './dto/user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  isActive: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;

export type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserListQueryDto): Promise<{ items: UserRow[]; total: number }> {
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {
      trashedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.role ? { roles: { some: { role: { name: query.role } } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: query.order ?? 'desc' },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<UserRow | null> {
    return this.prisma.user.findFirst({ where: { id, trashedAt: null }, select: USER_SELECT });
  }

  findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  findRolesByNames(names: string[]): Promise<{ id: string; name: string; isSystem: boolean }[]> {
    return this.prisma.role.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true, isSystem: true },
    });
  }

  async create(data: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    roleIds: string[];
  }): Promise<UserRow> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true,
        isVerified: false,
        roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
      },
      select: USER_SELECT,
    });
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      roleIds?: string[];
    },
  ): Promise<UserRow> {
    return this.prisma.$transaction(async (tx) => {
      if (data.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        select: USER_SELECT,
      });
    });
  }

  async softDelete(id: string, trashedByUserId: string): Promise<{ trashedAt: Date | null }> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { trashedAt: new Date(), trashedByUserId, isActive: false },
      select: { trashedAt: true },
    });
    return updated;
  }
}
