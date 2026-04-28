export const WEBHOOK_EVENTS = {
  CONTENT_CREATED: 'content.created',
  CONTENT_UPDATED: 'content.updated',
  CONTENT_PUBLISHED: 'content.published',
  CONTENT_UNPUBLISHED: 'content.unpublished',
  CONTENT_TRASHED: 'content.trashed',
  MEDIA_UPLOADED: 'media.uploaded',
  USER_CREATED: 'user.created',
  WEBHOOK_TEST: 'webhook.test',
} as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const ALL_WEBHOOK_EVENT_NAMES = Object.values(WEBHOOK_EVENTS) as WebhookEventName[];

export interface WebhookEventPayload {
  [key: string]: unknown;
}
