import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { kast } from '@/lib/kast';
import { getPostBySlug, estimateReadTime, BLOG_TYPE } from '@/lib/content';
import { RichText } from '@/components/rich-text';
import { getPosts } from '@/lib/content';

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateStaticParams() {
  const { data: posts } = await getPosts({ limit: '100' });
  return posts.map((p) => ({ slug: p.data.slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  let seoTitle = post.data.title;
  let seoDescription = post.data.excerpt;
  let seoImage: string | undefined = post.data.coverImage;

  // Enrich with Kast SEO meta if available
  try {
    const seoRes = await kast.seo.getMeta(post.id);
    if (seoRes.data) {
      seoTitle = seoRes.data.metaTitle ?? seoTitle;
      seoDescription = seoRes.data.metaDescription ?? seoDescription;
      seoImage = seoRes.data.ogImage ?? seoImage;
    }
  } catch {
    // SEO meta not found — use content data defaults
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';

  return {
    title: seoTitle,
    description: seoDescription,
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: 'article',
      publishedTime: post.data.publishedAt,
      authors: post.data.author ? [post.data.author] : undefined,
      images: seoImage ? [{ url: seoImage }] : undefined,
      url: `${siteUrl}/blog/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: seoImage ? [seoImage] : undefined,
    },
    alternates: {
      canonical: `${siteUrl}/blog/${slug}`,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const readTime = post.data.readTimeMinutes ?? estimateReadTime(post.data.body ?? '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.data.title,
            description: post.data.excerpt,
            image: post.data.coverImage,
            datePublished: post.data.publishedAt ?? post.createdAt,
            dateModified: post.updatedAt,
            author: post.data.author
              ? { '@type': 'Person', name: post.data.author }
              : undefined,
            url: `${siteUrl}/blog/${slug}`,
          }),
        }}
      />

      {/* Category badge */}
      {post.data.category && (
        <a
          href={`/categories/${post.data.category}`}
          className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline"
        >
          {post.data.category}
        </a>
      )}

      {/* Title */}
      <h1 className="mt-3 text-4xl font-bold leading-tight text-gray-900 dark:text-white">
        {post.data.title}
      </h1>

      {/* Meta */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {post.data.author && <span>{post.data.author}</span>}
        {post.data.publishedAt && (
          <time dateTime={post.data.publishedAt}>
            {new Date(post.data.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
        <span>{readTime} min read</span>
      </div>

      {/* Cover image */}
      {post.data.coverImage && (
        <div className="mt-8 rounded-2xl overflow-hidden aspect-video relative">
          <Image
            src={post.data.coverImage}
            alt={post.data.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Body */}
      <div className="mt-10">
        <RichText html={post.data.body ?? ''} />
      </div>

      {/* Tags */}
      {post.data.tags && post.data.tags.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap gap-2">
            {post.data.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-10">
        <a
          href="/blog"
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
        >
          ← Back to blog
        </a>
      </div>
    </article>
  );
}
