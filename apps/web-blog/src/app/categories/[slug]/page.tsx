import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategories, getPostsByCategory } from '@/lib/content';
import { PostCard } from '@/components/post-card';

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ slug: cat.data.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const cat = categories.find((c) => c.data.slug === slug);
  if (!cat) return {};
  return {
    title: cat.data.name,
    description: cat.data.description,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { cursor } = await searchParams;

  const categories = await getCategories();
  const category = categories.find((c) => c.data.slug === slug);
  if (!category) notFound();

  const { data: posts, nextCursor } = await getPostsByCategory(slug, { cursor });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          Category
        </span>
        <h1 className="mt-2 text-4xl font-bold">{category.data.name}</h1>
        {category.data.description && (
          <p className="mt-3 text-gray-600 dark:text-gray-400">{category.data.description}</p>
        )}
      </div>

      {posts.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-16">No posts in this category yet.</p>
      )}

      {(cursor || nextCursor) && (
        <div className="flex justify-between mt-12">
          {cursor ? (
            <a
              href={`/categories/${slug}`}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              ← Newer
            </a>
          ) : (
            <span />
          )}
          {nextCursor && (
            <a
              href={`/categories/${slug}?cursor=${nextCursor}`}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              Older →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
