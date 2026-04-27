import type { Metadata } from 'next';
import { getPosts, getCategories } from '@/lib/content';
import { PostCard } from '@/components/post-card';
import { CategoryPill } from '@/components/category-pill';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'All articles',
};

export const revalidate = 60;

interface BlogPageProps {
  searchParams: Promise<{ cursor?: string; category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { cursor, category } = await searchParams;

  const [{ data: posts, nextCursor }, categories] = await Promise.all([
    getPosts({ cursor, limit: '12' }),
    getCategories(),
  ]);

  const filtered = category
    ? posts.filter((p) => p.data.category === category)
    : posts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-4">Blog</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10">
        Thoughts, stories, and ideas.
      </p>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          <CategoryPill name="All" slug="" active={!category} />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              name={cat.data.name}
              slug={cat.data.slug}
              active={category === cat.data.slug}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-16">No posts found.</p>
      )}

      {/* Pagination */}
      {(cursor || nextCursor) && (
        <div className="flex justify-between mt-12">
          {cursor ? (
            <a
              href="/blog"
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-sm"
            >
              ← Newer posts
            </a>
          ) : (
            <span />
          )}
          {nextCursor && (
            <a
              href={`/blog?cursor=${nextCursor}`}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-sm"
            >
              Older posts →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
