import { Injectable } from '@nestjs/common';
import { Prisma, type GlobalSetting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SettingPatch {
  key: string;
  value: Prisma.InputJsonValue;
  /** Omitted patches leave the existing visibility (and the column default) alone. */
  isPublic?: boolean;
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<GlobalSetting[]> {
    return this.prisma.globalSetting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  findPublic(): Promise<Pick<GlobalSetting, 'key' | 'value'>[]> {
    return this.prisma.globalSetting.findMany({
      where: { isPublic: true },
      select: { key: true, value: true },
      orderBy: { key: 'asc' },
    });
  }

  findByKey(key: string): Promise<GlobalSetting | null> {
    return this.prisma.globalSetting.findUnique({ where: { key } });
  }

  upsert(
    key: string,
    value: Prisma.InputJsonValue,
    updatedBy: string | undefined,
  ): Promise<GlobalSetting> {
    const group = key.split('.')[0] ?? key;
    const by = updatedBy ?? null;
    return this.prisma.globalSetting.upsert({
      where: { key },
      update: { value, updatedBy: by },
      create: { key, value, group, updatedBy: by },
    });
  }

  upsertMany(patches: SettingPatch[], updatedBy: string | null): Promise<GlobalSetting[]> {
    const by = updatedBy ?? null;
    return this.prisma.$transaction(
      patches.map(({ key, value, isPublic }) => {
        const group = key.split('.')[0] ?? key;
        const visibility = isPublic === undefined ? {} : { isPublic };
        return this.prisma.globalSetting.upsert({
          where: { key },
          update: { value, updatedBy: by, ...visibility },
          create: { key, value, group, updatedBy: by, ...visibility },
        });
      }),
    );
  }
}
