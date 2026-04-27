import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FormSubmission } from '@prisma/client';
import type {
  CreateFormDto,
  ListSubmissionsQueryDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/form.dto';
import {
  FormRepository,
  type FormRow,
  type FormWithFields,
  type PaginatedSubmissions,
} from './form.repository';

function buildCsvRow(values: string[]): string {
  return values.map((v) => `"${v.replace(/"/g, '""')}"`).join(',');
}

function submissionToCsvRow(sub: FormSubmission, keys: string[]): string {
  const data = sub.data as Record<string, unknown>;
  const values = [
    sub.id,
    sub.createdAt.toISOString(),
    sub.ipAddress ?? '',
    ...keys.map((k) => String(data[k] ?? '')),
  ];
  return buildCsvRow(values);
}

@Injectable()
export class FormService {
  constructor(private readonly repo: FormRepository) {}

  list(): Promise<FormRow[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<FormWithFields> {
    const form = await this.repo.findById(id);
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return form;
  }

  async create(dto: CreateFormDto): Promise<FormWithFields> {
    try {
      return await this.repo.create(dto);
    } catch {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }
  }

  async update(id: string, dto: UpdateFormDto): Promise<FormWithFields> {
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

  async submit(id: string, dto: SubmitFormDto, ip?: string, ua?: string): Promise<void> {
    if (dto._hp) return; // honeypot triggered — silently discard

    const form = await this.repo.findById(id);
    if (!form?.isActive) return; // unknown/inactive forms silently ignored

    await this.repo.createSubmission(id, dto.data, ip, ua);
  }

  getSubmissions(id: string, query: ListSubmissionsQueryDto): Promise<PaginatedSubmissions> {
    return this.repo.findSubmissions(id, query);
  }

  async deleteSubmission(formId: string, subId: string): Promise<void> {
    await this.findOne(formId);
    await this.repo.deleteSubmission(subId);
  }

  async exportCsv(id: string): Promise<string> {
    await this.findOne(id);
    const submissions = await this.repo.findAllSubmissions(id);

    if (submissions.length === 0) return 'id,submitted_at,ip_address\n';

    const first = submissions[0];
    const dataKeys = Object.keys(first?.data as Record<string, unknown>);
    const header = buildCsvRow(['id', 'submitted_at', 'ip_address', ...dataKeys]);
    const rows = submissions.map((s) => submissionToCsvRow(s, dataKeys));

    return [header, ...rows].join('\n') + '\n';
  }
}
