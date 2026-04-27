import type { ChangelogEntry as ChangelogEntryType } from '@/types';

const TYPE_COLORS = {
  major: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  minor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  patch: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  security: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
} as const;

interface ChangelogEntryProps {
  entry: ChangelogEntryType;
}

export function ChangelogEntry({ entry }: ChangelogEntryProps) {
  const typeColor = entry.data.type ? TYPE_COLORS[entry.data.type] : TYPE_COLORS.patch;
  const releaseDate = new Date(entry.data.releasedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-7 h-7 rounded-full bg-white dark:bg-gray-950 border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          v{entry.data.version}
        </h2>
        {entry.data.type && (
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${typeColor}`}>
            {entry.data.type}
          </span>
        )}
        <time
          className="text-sm text-gray-500 dark:text-gray-400"
          dateTime={entry.data.releasedAt}
        >
          {releaseDate}
        </time>
      </div>

      {entry.data.summary && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">{entry.data.summary}</p>
      )}

      {entry.data.body && (
        <div
          className="prose max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: entry.data.body }}
        />
      )}
    </div>
  );
}
