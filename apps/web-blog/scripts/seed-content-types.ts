/**
 * Seed script: creates the blog-post and blog-category content types in Kast CMS.
 *
 * Usage:
 *   KAST_API_URL=http://localhost:3000 KAST_ADMIN_TOKEN=your-token pnpm seed
 */
import { KastClient, type AddFieldBody } from '@kast-cms/sdk';

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

interface TypeSpec {
  /** Identifier the blog queries by — see src/lib/content.ts. */
  name: string;
  displayName: string;
  description: string;
  fields: AddFieldBody[];
}

function isAlreadyExists(err: unknown): boolean {
  const error = err as { status?: number; message?: string };
  return error.status === 409 || (error.message?.includes('already exists') ?? false);
}

function describe(err: unknown): string {
  const error = err as { message?: string };
  return error.message ?? String(err);
}

/**
 * Content types and their fields are separate resources: the type is created
 * first, then each field is posted to /content-types/:name/fields.
 */
async function seedType(spec: TypeSpec): Promise<void> {
  try {
    await kast.contentTypes.create({
      name: spec.name,
      displayName: spec.displayName,
      description: spec.description,
    });
    console.log(`✓ Created content type: ${spec.name}`);
  } catch (err) {
    if (!isAlreadyExists(err)) {
      console.error(`✗ Failed to create ${spec.name}: ${describe(err)}`);
      return;
    }
    console.log(`- Content type already exists: ${spec.name}`);
  }

  for (const [position, field] of spec.fields.entries()) {
    try {
      await kast.contentTypes.addField(spec.name, { ...field, position });
      console.log(`  ✓ ${spec.name}.${field.name}`);
    } catch (err) {
      if (isAlreadyExists(err)) console.log(`  - ${spec.name}.${field.name} already exists`);
      else console.error(`  ✗ ${spec.name}.${field.name}: ${describe(err)}`);
    }
  }
}

const TYPES: TypeSpec[] = [
  {
    name: 'blog-category',
    displayName: 'Blog Category',
    description: 'Taxonomy categories for blog posts',
    fields: [
      { name: 'name', displayName: 'Category Name', type: 'TEXT', isRequired: true },
      { name: 'slug', displayName: 'URL Slug', type: 'TEXT', isRequired: true, isUnique: true },
      { name: 'description', displayName: 'Description', type: 'TEXT' },
    ],
  },
  {
    name: 'blog-post',
    displayName: 'Blog Post',
    description: 'Blog article content type',
    fields: [
      { name: 'title', displayName: 'Title', type: 'TEXT', isRequired: true, isLocalized: true },
      { name: 'slug', displayName: 'URL Slug', type: 'TEXT', isRequired: true, isUnique: true },
      { name: 'excerpt', displayName: 'Excerpt', type: 'TEXT', isLocalized: true },
      { name: 'body', displayName: 'Body', type: 'RICH_TEXT', isRequired: true, isLocalized: true },
      { name: 'coverImage', displayName: 'Cover Image URL', type: 'URL' },
      { name: 'publishedAt', displayName: 'Published At', type: 'DATE' },
      { name: 'author', displayName: 'Author', type: 'TEXT' },
      { name: 'category', displayName: 'Category Slug', type: 'TEXT' },
      { name: 'tags', displayName: 'Tags', type: 'JSON' },
      { name: 'readTimeMinutes', displayName: 'Read Time (minutes)', type: 'NUMBER' },
    ],
  },
];

async function main(): Promise<void> {
  console.log('Seeding Kast CMS content types for web-blog...\n');
  for (const spec of TYPES) await seedType(spec);
  console.log('\nDone! You can now create content in the Kast Admin panel.');
  console.log(`Admin URL: ${apiUrl.replace(':3000', ':3001')}/admin`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
