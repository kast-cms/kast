/**
 * Seed script: creates doc-page and changelog-entry content types in Kast CMS.
 *
 * Usage:
 *   KAST_API_URL=http://localhost:3000 KAST_ADMIN_TOKEN=your-token pnpm seed
 */
import { KastClient } from '@kast/sdk';

const apiUrl = process.env.KAST_API_URL;
const adminToken = process.env.KAST_ADMIN_TOKEN;

if (!apiUrl) {
  console.error('Missing KAST_API_URL environment variable');
  process.exit(1);
}

if (!adminToken) {
  console.error('Missing KAST_ADMIN_TOKEN environment variable');
  process.exit(1);
}

const kast = new KastClient({
  baseUrl: apiUrl,
  accessToken: adminToken,
});

async function createContentType(slug: string, payload: unknown) {
  try {
    await kast.contentTypes.create(payload as Parameters<typeof kast.contentTypes.create>[0]);
    console.log(`✓ Created content type: ${slug}`);
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status === 409 || (error.message && error.message.includes('already exists'))) {
      console.log(`- Content type already exists: ${slug}`);
    } else {
      console.error(`✗ Failed to create ${slug}:`, error.message ?? error);
    }
  }
}

async function main() {
  console.log('Seeding Kast CMS content types for web-docs...\n');

  // Doc Page
  await createContentType('doc-page', {
    name: 'Documentation Page',
    slug: 'doc-page',
    description: 'A single documentation page with rich-text body',
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'TEXT',
        required: true,
        order: 0,
      },
      {
        name: 'slug',
        label: 'URL Slug',
        type: 'TEXT',
        required: true,
        order: 1,
      },
      {
        name: 'category',
        label: 'Category Name',
        type: 'TEXT',
        required: true,
        order: 2,
      },
      {
        name: 'categorySlug',
        label: 'Category Slug',
        type: 'TEXT',
        required: true,
        order: 3,
      },
      {
        name: 'excerpt',
        label: 'Short Description',
        type: 'TEXTAREA',
        required: false,
        order: 4,
      },
      {
        name: 'body',
        label: 'Body',
        type: 'RICH_TEXT',
        required: true,
        order: 5,
      },
      {
        name: 'order',
        label: 'Sidebar Order',
        type: 'NUMBER',
        required: false,
        order: 6,
      },
      {
        name: 'publishedAt',
        label: 'Published At',
        type: 'DATE',
        required: false,
        order: 7,
      },
    ],
  });

  // Changelog Entry
  await createContentType('changelog-entry', {
    name: 'Changelog Entry',
    slug: 'changelog-entry',
    description: 'A versioned release changelog entry',
    fields: [
      {
        name: 'version',
        label: 'Version',
        type: 'TEXT',
        required: true,
        order: 0,
      },
      {
        name: 'releasedAt',
        label: 'Released At',
        type: 'DATE',
        required: true,
        order: 1,
      },
      {
        name: 'type',
        label: 'Release Type',
        type: 'TEXT',
        required: false,
        order: 2,
      },
      {
        name: 'summary',
        label: 'Summary',
        type: 'TEXTAREA',
        required: true,
        order: 3,
      },
      {
        name: 'body',
        label: 'Details (Rich Text)',
        type: 'RICH_TEXT',
        required: false,
        order: 4,
      },
    ],
  });

  console.log('\nDone! You can now create documentation content in the Kast Admin panel.');
  console.log(`Admin URL: ${apiUrl.replace(':3000', ':3001')}/admin`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
