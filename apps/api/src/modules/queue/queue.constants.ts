export const QUEUE_NAMES = {
  WEBHOOK: 'kast.webhook',
  MEDIA: 'kast.media',
  SEO: 'kast.seo',
  PUBLISH: 'kast.publish',
  EMAIL: 'kast.email',
  TRASH: 'kast.trash',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
