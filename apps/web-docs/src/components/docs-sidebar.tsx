import type { SidebarCategory } from '@/types';

interface DocsSidebarProps {
  sidebar: SidebarCategory[];
  activeCategorySlug: string;
  activeSlug: string;
}

export function DocsSidebar({ sidebar, activeCategorySlug, activeSlug }: DocsSidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200 dark:border-gray-800 py-8 px-4 overflow-y-auto max-h-[calc(100vh-3.5rem)] sticky top-14">
      {sidebar.map((cat) => (
        <div key={cat.slug} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-2 px-2">
            {cat.name}
          </p>
          <ul className="space-y-0.5">
            {cat.items.map((item) => {
              const isActive =
                cat.slug === activeCategorySlug && item.slug === activeSlug;
              return (
                <li key={item.slug}>
                  <a
                    href={`/docs/${item.categorySlug}/${item.slug}`}
                    className={[
                      'block px-3 py-1.5 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-200',
                    ].join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
