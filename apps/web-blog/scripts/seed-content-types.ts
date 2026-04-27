/**
 * Seed script: creates blog-post and blog-category content types in Kast CMS.
 *
 * Usage:
 *   KAST_API_URL=http://localhost:3000 KAST_ADMIN_TOKEN=your-token pnpm seed
 */
import { KastClient } from '@kast-cms/sdk';

const apiUrl = process.env.KAST_API_URL ?? '';
const adminToken = process.env.KAST_ADMIN_TOKEN ?? '';

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
  console.log('Seeding Kast CMS content types for web-blog...\n');

  // Blog Category
  await createContentType('blog-category', {
    name: 'Blog Category',
    slug: 'blog-category',
    description: 'Taxonomy categories for blog posts',
    fields: [
      {
        name: 'name',
        label: 'Category Name',
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
        name: 'description',
        label: 'Description',
        type: 'TEXTAREA',
        required: false,
        order: 2,
      },
    ],
  });

  // Blog Post
  await createContentType('blog-post', {
    name: 'Blog Post',
    slug: 'blog-post',
    description: 'Blog article content type',
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
        name: 'excerpt',
        label: 'Excerpt',
        type: 'TEXTAREA',
        required: false,
        order: 2,
      },
      {
        name: 'body',
        label: 'Body',
        type: 'RICH_TEXT',
        required: true,
        order: 3,
      },
      {
        name: 'coverImage',
        label: 'Cover Image URL',
        type: 'TEXT',
        required: false,
        order: 4,
      },
      {
        name: 'publishedAt',
        label: 'Published At',
        type: 'DATE',
        required: false,
        order: 5,
      },
      {
        name: 'author',
        label: 'Author',
        type: 'TEXT',
        required: false,
        order: 6,
      },
      {
        name: 'category',
        label: 'Category Slug',
        type: 'TEXT',
        required: false,
        order: 7,
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'JSON',
        required: false,
        order: 8,
      },
      {
        name: 'readTimeMinutes',
        label: 'Read Time (minutes)',
        type: 'NUMBER',
        required: false,
        order: 9,
      },
    ],
  });

  console.log('\nDone! You can now create content in the Kast Admin panel.');
  console.log(`Admin URL: ${apiUrl.replace(':3000', ':3001')}/admin`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
