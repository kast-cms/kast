import type { Metadata } from 'next';
import { getPosts, getCategories } from '@/lib/content';
import { PostCard } from '@/components/post-card';
import { CategoryPill } from '@/components/category-pill';

export const metadata: Metadata = {
  title: 'Home',
};

export const revalidate = 60;

export default async function HomePage() {
  const [{ data: posts }, categories] = await Promise.all([
    getPosts({ limit: '6' }),
    getCategories(),
  ]);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <CategoryPill key={cat.id} name={cat.data.name} slug={cat.data.slug} />
          ))}
        </div>
      )}

      {/* Featured post */}
      {featured && (
        <div className="mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">
            Featured
          </h2>
          <PostCard post={featured} variant="featured" />
        </div>
      )}

      {/* Latest posts grid */}
      {rest.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-6">
            Latest
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      )}

      {posts.length === 0 && (
        <div className="text-center py-24">
          <p className="text-gray-500 text-lg">No posts yet. Check back soon!</p>
        </div>
      )}

      <div className="mt-12 text-center">
        <a
          href="/blog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          View all posts
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
