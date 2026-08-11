import { FormFieldType } from '@prisma/client';
import { renderSubmissionNotification } from './form-notification';
import { buildForm, buildFormField } from './validation/test-fixtures';

describe('renderSubmissionNotification', () => {
  const fields = [
    buildFormField({ name: 'email', label: 'Email', type: FormFieldType.EMAIL }),
    buildFormField({ name: 'message', label: 'Message' }),
  ];

  it('returns null when the form opted out of notifications', () => {
    const form = buildForm(fields, { notifyEmail: null });
    expect(renderSubmissionNotification(form, { email: 'a@b.com' })).toBeNull();
  });

  it('renders every declared field for the configured recipient', () => {
    const form = buildForm(fields, { notifyEmail: 'owner@kast.local' });

    const job = renderSubmissionNotification(form, { email: 'a@b.com', message: 'Hi' });

    expect(job?.to).toBe('owner@kast.local');
    expect(job?.subject).toBe('New submission: Contact');
    expect(job?.text).toContain('Email: a@b.com');
    expect(job?.text).toContain('Message: Hi');
  });

  it('escapes submitted markup', () => {
    const form = buildForm(fields, { notifyEmail: 'owner@kast.local' });

    const job = renderSubmissionNotification(form, { message: '<img src=x onerror=alert(1)>' });

    expect(job?.html).not.toContain('<img');
    expect(job?.html).toContain('&lt;img');
  });

  it('carries the declared fields only, never transport metadata', () => {
    const form = buildForm(fields, { notifyEmail: 'owner@kast.local' });

    const job = renderSubmissionNotification(form, {
      message: 'Hi',
      ipAddress: '203.0.113.7',
      userAgent: 'curl/8.0',
    });

    const body = `${job?.html ?? ''}${job?.text ?? ''}`;
    expect(body).toContain('Hi');
    expect(body).not.toContain('203.0.113.7');
    expect(body).not.toContain('curl/8.0');
  });
});
