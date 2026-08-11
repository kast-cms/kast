import { NotFoundException } from '@nestjs/common';
import { FormFieldType, type FormSubmission } from '@prisma/client';
import type { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { FormRepository } from './form.repository';
import { FormService } from './form.service';
import { clearFormSchemaCache } from './validation/form-schema.compiler';
import { buildForm, buildFormField } from './validation/test-fixtures';

type Mocked<T> = { [K in keyof T]: jest.Mock };

const CONTACT_FIELDS = [
  buildFormField({ name: 'email', label: 'Email', type: FormFieldType.EMAIL, isRequired: true }),
  buildFormField({ name: 'message', label: 'Message', type: FormFieldType.TEXTAREA }),
];

function buildSubmission(overrides: Partial<FormSubmission> = {}): FormSubmission {
  return {
    id: 'sub-1',
    formId: 'form-1',
    data: {},
    ipAddress: null,
    userAgent: null,
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as FormSubmission;
}

describe('FormService', () => {
  let repo: Mocked<FormRepository>;
  let queue: Mocked<QueueAdapter>;
  let service: FormService;

  beforeEach(() => {
    clearFormSchemaCache();
    repo = {
      findById: jest.fn(),
      createSubmission: jest.fn().mockResolvedValue(buildSubmission()),
      setSubmissionRead: jest.fn(),
      deleteSubmission: jest.fn(),
    } as unknown as Mocked<FormRepository>;
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as Mocked<QueueAdapter>;
    service = new FormService(repo as unknown as FormRepository, queue as unknown as QueueAdapter);
  });

  describe('submit', () => {
    it('stores only the validated fields', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));

      await service.submit(
        'form-1',
        { data: { email: ' Person@Example.COM ', message: ' hi ' } },
        '203.0.113.7',
        'agent',
      );

      expect(repo.createSubmission).toHaveBeenCalledWith(
        'form-1',
        { email: 'Person@example.com', message: 'hi' },
        '203.0.113.7',
        'agent',
      );
    });

    it('rejects a payload that does not satisfy the form schema', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));

      await expect(
        service.submit('form-1', { data: { message: 'hi', isAdmin: true } }),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'FORM_SUBMISSION_INVALID',
          message: 'Submission is invalid',
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email', rule: 'required' }),
            expect.objectContaining({ field: 'isAdmin', rule: 'unknown_field' }),
          ]),
        },
      });
      expect(repo.createSubmission).not.toHaveBeenCalled();
    });

    it('answers an unknown form exactly like an inactive one, without validating', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.submit('ghost', { data: { nonsense: true } })).resolves.toBeUndefined();

      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS, { isActive: false }));
      await expect(service.submit('form-1', { data: { nonsense: true } })).resolves.toBeUndefined();

      expect(repo.createSubmission).not.toHaveBeenCalled();
    });

    it('discards a honeypot hit before touching the database', async () => {
      await service.submit('form-1', { data: {}, _hp: 'bot' });

      expect(repo.findById).not.toHaveBeenCalled();
      expect(repo.createSubmission).not.toHaveBeenCalled();
    });

    it('enqueues a notification for a form that configured one', async () => {
      repo.findById.mockResolvedValue(
        buildForm(CONTACT_FIELDS, { notifyEmail: 'owner@kast.local' }),
      );

      await service.submit('form-1', { data: { email: 'a@b.com', message: 'hi' } });

      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.EMAIL,
        'form-submission',
        expect.objectContaining({ to: 'owner@kast.local', subject: 'New submission: Contact' }),
      );
    });

    it('does not enqueue anything when no recipient is configured', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));

      await service.submit('form-1', { data: { email: 'a@b.com' } });

      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('keeps the submission when the notification cannot be enqueued', async () => {
      repo.findById.mockResolvedValue(
        buildForm(CONTACT_FIELDS, { notifyEmail: 'owner@kast.local' }),
      );
      queue.enqueue.mockRejectedValue(new Error('redis down'));

      await expect(
        service.submit('form-1', { data: { email: 'a@b.com' } }),
      ).resolves.toBeUndefined();
      expect(repo.createSubmission).toHaveBeenCalled();
    });
  });

  describe('setSubmissionRead', () => {
    it('marks a submission read', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));
      const read = buildSubmission({ isRead: true, readAt: new Date('2026-02-01T00:00:00Z') });
      repo.setSubmissionRead.mockResolvedValue(read);

      await expect(service.setSubmissionRead('form-1', 'sub-1', true)).resolves.toBe(read);
      expect(repo.setSubmissionRead).toHaveBeenCalledWith('form-1', 'sub-1', true);
    });

    it('404s for a submission that does not belong to the form', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));
      repo.setSubmissionRead.mockResolvedValue(null);

      await expect(service.setSubmissionRead('form-1', 'other', true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s for an unknown form', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.setSubmissionRead('ghost', 'sub-1', true)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.setSubmissionRead).not.toHaveBeenCalled();
    });
  });

  describe('deleteSubmission', () => {
    it('deletes a submission of the named form', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));
      repo.deleteSubmission.mockResolvedValue(true);

      await expect(service.deleteSubmission('form-1', 'sub-1')).resolves.toBeUndefined();
      expect(repo.deleteSubmission).toHaveBeenCalledWith('form-1', 'sub-1');
    });

    it('404s rather than deleting a submission that belongs to another form', async () => {
      repo.findById.mockResolvedValue(buildForm(CONTACT_FIELDS));
      repo.deleteSubmission.mockResolvedValue(false);

      await expect(service.deleteSubmission('form-1', 'other-form-sub')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
