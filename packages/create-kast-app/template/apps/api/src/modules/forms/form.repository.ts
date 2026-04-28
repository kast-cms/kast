import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Form,
  type FormField,
  type FormFieldType,
  type FormSubmission,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateFormDto,
  FormFieldDto,
  ListSubmissionsQueryDto,
  UpdateFormDto,
} from './dto/form.dto';

export type FormRow = Form & { fields: FormField[]; _count: { submissions: number } };
export type FormWithFields = Form & { fields: FormField[] };

type FieldInput = {
  name: string;
  label: string;
  type: FormFieldType;
  isRequired: boolean;
  position: number;
  config: Prisma.InputJsonValue;
};

function toFieldInput(f: FormFieldDto): FieldInput {
  return {
    name: f.name,
    label: f.label,
    type: f.type,
    isRequired: f.isRequired ?? false,
    position: f.position ?? 0,
    config: (f.config ?? {}) as Prisma.InputJsonValue,
  };
}

export type PaginatedSubmissions = {
  data: FormSubmission[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class FormRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<FormRow[]> {
    return this.prisma.form.findMany({
      where: { trashedAt: null },
      include: {
        fields: { orderBy: { position: 'asc' } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<FormWithFields | null> {
    return this.prisma.form.findFirst({
      where: { id, trashedAt: null },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  async create(dto: CreateFormDto): Promise<FormWithFields> {
    const { fields, ...rest } = dto;
    return this.prisma.form.create({
      data: {
        name: rest.name,
        slug: rest.slug,
        ...(rest.description !== undefined ? { description: rest.description } : {}),
        ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        ...(rest.notifyEmail !== undefined ? { notifyEmail: rest.notifyEmail } : {}),
        fields: { create: fields.map(toFieldInput) },
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  async update(id: string, dto: UpdateFormDto): Promise<FormWithFields> {
    const { fields, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      await tx.form.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.slug !== undefined ? { slug: rest.slug } : {}),
          ...(rest.description !== undefined ? { description: rest.description } : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          ...(rest.notifyEmail !== undefined ? { notifyEmail: rest.notifyEmail } : {}),
        },
      });

      if (fields !== undefined) {
        await tx.formField.deleteMany({ where: { formId: id } });
        await tx.formField.createMany({
          data: fields.map((f) => ({ ...toFieldInput(f), formId: id })),
        });
      }

      const updated = await tx.form.findUniqueOrThrow({
        where: { id },
        include: { fields: { orderBy: { position: 'asc' } } },
      });
      return updated;
    });
  }

  delete(id: string): Promise<Form> {
    return this.prisma.form.update({ where: { id }, data: { trashedAt: new Date() } });
  }

  createSubmission(
    formId: string,
    data: Record<string, unknown>,
    ip?: string,
    ua?: string,
  ): Promise<FormSubmission> {
    return this.prisma.formSubmission.create({
      data: {
        formId,
        data: data as Prisma.InputJsonValue,
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      },
    });
  }

  async findSubmissions(
    formId: string,
    query: ListSubmissionsQueryDto,
  ): Promise<PaginatedSubmissions> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: { formId: string; createdAt?: { gte?: Date; lte?: Date } } = { formId };
    if (query.from !== undefined || query.to !== undefined) {
      where.createdAt = {
        ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
        ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  deleteSubmission(subId: string): Promise<FormSubmission> {
    return this.prisma.formSubmission.delete({ where: { id: subId } });
  }

  findAllSubmissions(formId: string): Promise<FormSubmission[]> {
    return this.prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
