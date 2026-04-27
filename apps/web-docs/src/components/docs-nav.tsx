const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'My Docs';

export function DocsNav() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur">
      <div className="h-full flex items-center px-6 gap-6">
        <a
          href="/"
          className="text-base font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {siteName}
        </a>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
        <nav className="flex items-center gap-4 text-sm">
          <a
            href="/docs"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Docs
          </a>
          <a
            href="/changelog"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Changelog
          </a>
        </nav>
      </div>
    </header>
  );
}
