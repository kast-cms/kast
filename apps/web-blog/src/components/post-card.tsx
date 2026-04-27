import Image from 'next/image';
import type { PostEntry } from '@/types';

interface PostCardProps {
  post: PostEntry;
  variant?: 'default' | 'featured';
}

export function PostCard({ post, variant = 'default' }: PostCardProps) {
  const href = `/blog/${post.data.slug}`;
  const pubDate = post.data.publishedAt
    ? new Date(post.data.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  if (variant === 'featured') {
    return (
      <a
        href={href}
        className="group grid sm:grid-cols-2 gap-8 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-900"
      >
        {post.data.coverImage && (
          <div className="relative aspect-video sm:aspect-auto overflow-hidden">
            <Image
              src={post.data.coverImage}
              alt={post.data.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-8 flex flex-col justify-center">
          {post.data.category && (
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
              {post.data.category}
            </span>
          )}
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {post.data.title}
          </h3>
          {post.data.excerpt && (
            <p className="mt-3 text-gray-600 dark:text-gray-400 line-clamp-3">{post.data.excerpt}</p>
          )}
          <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-500">
            {post.data.author && <span>{post.data.author}</span>}
            {pubDate && <span>·</span>}
            {pubDate && <time dateTime={post.data.publishedAt}>{pubDate}</time>}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      className="group flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-900"
    >
      {post.data.coverImage && (
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={post.data.coverImage}
            alt={post.data.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        {post.data.category && (
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            {post.data.category}
          </span>
        )}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.data.title}
        </h3>
        {post.data.excerpt && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{post.data.excerpt}</p>
        )}
        <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
          {post.data.author && <span>{post.data.author}</span>}
          {pubDate && <span>·</span>}
          {pubDate && <time dateTime={post.data.publishedAt}>{pubDate}</time>}
        </div>
      </div>
    </a>
  );
}
