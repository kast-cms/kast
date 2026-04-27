import type { Metadata } from 'next';
import { getChangelog } from '@/lib/content';
import { ChangelogEntry } from '@/components/changelog-entry';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release history and version notes.',
};

export const revalidate = 3600;

interface ChangelogPageProps {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function ChangelogPage({ searchParams }: ChangelogPageProps) {
  const { cursor } = await searchParams;
  const { data: entries, nextCursor } = await getChangelog({ cursor });

  return (
    <div className="max-w-3xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-bold mb-2">Changelog</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-12">
        All notable changes are documented here.
      </p>

      {entries.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-12">
            {entries.map((entry) => (
              <ChangelogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-16">No changelog entries yet.</p>
      )}

      {(cursor || nextCursor) && (
        <div className="flex justify-between mt-12">
          {cursor ? (
            <a href="/changelog" className="text-sm text-blue-600 hover:underline">
              ← Newer releases
            </a>
          ) : (
            <span />
          )}
          {nextCursor && (
            <a href={`/changelog?cursor=${nextCursor}`} className="text-sm text-blue-600 hover:underline">
              Older releases →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
