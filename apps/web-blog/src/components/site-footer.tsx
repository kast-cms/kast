const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'My Blog';

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-500">
        <p>
          © {new Date().getFullYear()} {siteName}. Powered by{' '}
          <a
            href="https://github.com/kast-cms/kast"
            className="hover:text-gray-900 dark:hover:text-white transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          >
            Kast CMS
          </a>
          .
        </p>
        <div className="flex items-center gap-4">
          <a href="/feed.xml" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            RSS
          </a>
          <a href="/sitemap.xml" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Sitemap
          </a>
        </div>
      </div>
    </footer>
  );
}
