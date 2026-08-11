import type { FormWithFields } from './form.repository';

export interface FormNotificationJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const MAX_VALUE_LENGTH = 500;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ');
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

/**
 * Builds the notification for a form's configured recipient. Carries the answers
 * only: the submitter's IP address and user agent stay in the admin panel, behind
 * authentication, rather than being mailed out to whoever the form points at.
 *
 * Returns null when the form opted out by leaving notifyEmail unset.
 */
export function renderSubmissionNotification(
  form: FormWithFields,
  data: Record<string, unknown>,
): FormNotificationJobData | null {
  if (!form.notifyEmail) return null;

  const rows = form.fields.map((field) => ({
    label: field.label !== '' ? field.label : field.name,
    value: formatValue(data[field.name]),
  }));

  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">',
    `<h2>New submission: ${escapeHtml(form.name)}</h2>`,
    '<table style="border-collapse:collapse;width:100%">',
    ...rows.map(
      (row) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(row.label)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(row.value)}</td></tr>`,
    ),
    '</table>',
    '</div>',
  ].join('');

  const text = [
    `New submission: ${form.name}`,
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join('\n');

  return { to: form.notifyEmail, subject: `New submission: ${form.name}`, html, text };
}
