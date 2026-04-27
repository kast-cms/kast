interface CategoryPillProps {
  name: string;
  slug: string;
  active?: boolean;
}

export function CategoryPill({ name, slug, active }: CategoryPillProps) {
  const href = slug ? `/categories/${slug}` : '/blog';
  return (
    <a
      href={href}
      className={[
        'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      {name}
    </a>
  );
}
