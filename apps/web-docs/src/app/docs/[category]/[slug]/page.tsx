import { DocsSidebar } from '@/components/docs-sidebar';
import { DocsToc } from '@/components/docs-toc';
import { RichText } from '@/components/rich-text';
import { buildSidebar, extractToc, getDocBySlug, getDocs, injectHeadingIds } from '@/lib/content';
import { kast } from '@/lib/kast';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface DocPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ category: string; slug: string }>> {
  try {
    const docs = await getDocs();
    return docs.map((d) => ({
      category: d.data.categorySlug,
      slug: d.data.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const doc = await getDocBySlug(category, slug);
  if (!doc) return {};

  let title = doc.data.title;
  let description = doc.data.excerpt;

  try {
    const seoRes = await kast.seo.getMeta(doc.id);
    if (seoRes.data) {
      title = seoRes.data.metaTitle ?? title;
      description = seoRes.data.metaDescription ?? description;
    }
  } catch {
    // SEO meta not found — use content defaults
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003';

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/docs/${category}/${slug}`,
    },
  };
}

export default async function DocPage({ params }: DocPageProps): Promise<React.JSX.Element> {
  const { category, slug } = await params;

  const [doc, sidebar] = await Promise.all([getDocBySlug(category, slug), buildSidebar()]);

  if (!doc) notFound();

  const bodyWithIds = injectHeadingIds(doc.data.body ?? '');
  const toc = extractToc(doc.data.body ?? '');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <DocsSidebar sidebar={sidebar} activeCategorySlug={category} activeSlug={slug} />

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-10 max-w-3xl">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
          <a href="/docs" className="hover:text-gray-900 dark:hover:text-white">
            Docs
          </a>
          <span>›</span>
          <span className="capitalize">{doc.data.category}</span>
          <span>›</span>
          <span className="text-gray-900 dark:text-white">{doc.data.title}</span>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{doc.data.title}</h1>
        {doc.data.excerpt && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">{doc.data.excerpt}</p>
        )}

        <RichText html={bodyWithIds} />

        {/* Page navigation */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            Last updated:{' '}
            {new Date(doc.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </main>

      {/* TOC */}
      {toc.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0 py-10 px-4">
          <DocsToc headings={toc} />
        </aside>
      )}
    </div>
  );
}
