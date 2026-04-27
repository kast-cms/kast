import type { TocHeading } from '@/types';

interface DocsTocProps {
  headings: TocHeading[];
}

export function DocsToc({ headings }: DocsTocProps): React.JSX.Element {
  return (
    <nav aria-label="On this page">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-3">
        On this page
      </p>
      <ul className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'ml-3' : ''}>
            <a
              href={`#${h.id}`}
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors leading-snug"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
