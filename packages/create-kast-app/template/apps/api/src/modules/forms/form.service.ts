import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { FormSubmission } from '@prisma/client';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type {
  CreateFormDto,
  ListSubmissionsQueryDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/form.dto';
import { renderSubmissionNotification } from './form-notification';
import {
  FormRepository,
  type FormRow,
  type FormWithFields,
  type PaginatedSubmissions,
} from './form.repository';
import { compileFormSchema } from './validation/form-schema.compiler';
import { validateSubmission } from './validation/form-submission.validator';
import { FormSubmissionException } from './validation/form-validation.exception';

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
  private readonly logger = new Logger(FormService.name);

  constructor(
    private readonly repo: FormRepository,
    private readonly queue: QueueAdapter,
  ) {}

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

  async delete(id: string, actorId?: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id, actorId);
  }

  async submit(id: string, dto: SubmitFormDto, ip?: string, ua?: string): Promise<void> {
    if (dto._hp) return; // honeypot triggered — silently discard

    const form = await this.repo.findById(id);
    if (!form?.isActive) return; // unknown/inactive forms silently ignored

    const { data, issues } = validateSubmission(compileFormSchema(form), dto.data);
    if (issues.length > 0) throw new FormSubmissionException(issues);

    await this.repo.createSubmission(id, data, ip, ua);
    await this.notify(form, data);
  }

  getSubmissions(id: string, query: ListSubmissionsQueryDto): Promise<PaginatedSubmissions> {
    return this.repo.findSubmissions(id, query);
  }

  async deleteSubmission(formId: string, subId: string): Promise<void> {
    await this.findOne(formId);
    const deleted = await this.repo.deleteSubmission(formId, subId);
    if (!deleted) throw new NotFoundException(`Submission ${subId} not found`);
  }

  async setSubmissionRead(formId: string, subId: string, isRead: boolean): Promise<FormSubmission> {
    await this.findOne(formId);
    const updated = await this.repo.setSubmissionRead(formId, subId, isRead);
    if (!updated) throw new NotFoundException(`Submission ${subId} not found`);
    return updated;
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

  /**
   * The submission is already stored, so a queue outage must not fail the public
   * request or lose the answers — the notification is best effort.
   */
  private async notify(form: FormWithFields, data: Record<string, unknown>): Promise<void> {
    const job = renderSubmissionNotification(form, data);
    if (!job) return;
    try {
      await this.queue.enqueue(QUEUE_NAMES.EMAIL, 'form-submission', job);
    } catch (err: unknown) {
      this.logger.error(`Failed to enqueue submission notification for form ${form.id}`, err);
    }
  }
}
